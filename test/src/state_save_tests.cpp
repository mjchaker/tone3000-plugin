// State save tests
//
// getStateInformation (every host save and autosave) and savePreset embed
// every cached model's bytes so projects and presets reopen offline, easily
// tens of MB on a multi-model rig. The render thread blocks on chainMutex
// whenever it can't try-lock it (outside a chain-edit fade), so these pin:
//
//   - a save holds chainMutex only to snapshot settings and take references
//     to the model bytes; the copying happens after it is released, so a
//     concurrent processBlock never stalls behind it,
//   - the bytes still round-trip: a restored project carries every cached
//     model, byte for byte.
#include "Processor.h"
#include "chain_test_helpers.h"

#include <gtest/gtest.h>

#include <algorithm>
#include <atomic>
#include <chrono>
#include <cstdio>
#include <cstring>
#include <thread>
#include <vector>

namespace {

constexpr int kBlock = 512;
constexpr int kExtraModels = 4;
constexpr size_t kExtraModelBytes = 32u << 20;  // 4 x 32 MB of cached models

// A cab IR block whose ModelCache also carries large inactive models, the
// shape a multi-model tone takes after browsing several of its models.
juce::ValueTree makeHeavyRigState() {
  auto block = makeIrBlockTree("blk-cab", 1, 100);
  auto cache = block.getChildWithName("ModelCache");
  for (int i = 0; i < kExtraModels; ++i) {
    juce::MemoryBlock bytes(kExtraModelBytes, false);
    std::memset(bytes.getData(), 0x40 + i, bytes.getSize());
    juce::ValueTree cached("CachedModel");
    cached.setProperty("modelId", 1000 + i, nullptr);
    cached.setProperty("data", juce::var(bytes), nullptr);
    cache.appendChild(cached, nullptr);
  }
  juce::ValueTree state("ChainSnapshot");
  juce::ValueTree left("ChainBlocks");
  left.appendChild(block, nullptr);
  state.appendChild(left, nullptr);
  return state;
}

double millisSince(std::chrono::steady_clock::time_point t) {
  return std::chrono::duration<double, std::milli>(std::chrono::steady_clock::now() - t).count();
}

}  // namespace

TEST(StateSaveTest, SavingNeverStallsTheRenderThread) {
  ChainTestProcessor proc;
  proc.setPlayConfigDetails(2, 2, kFs, kBlock);
  proc.prepareToPlay(kFs, kBlock);
  proc.restoreFromTree(makeHeavyRigState());
  ASSERT_TRUE(waitForChainLoaded(proc));

  juce::AudioBuffer<float> buffer(2, kBlock);
  juce::MidiBuffer midi;
  const auto in = makeSine(kBlock, 440.0, 0.25f);

  std::atomic<bool> saving{true};
  double saveMs = 0.0;
  size_t savedBytes = 0;
  std::thread saver([&] {
    const auto start = std::chrono::steady_clock::now();
    for (int i = 0; i < 3; ++i) {
      juce::MemoryBlock state;
      proc.getStateInformation(state);
      savedBytes = state.getSize();
    }
    saveMs = millisSince(start) / 3.0;
    saving = false;
  });

  double worstBlockMs = 0.0;
  while (saving) {
    for (int ch = 0; ch < 2; ++ch)
      buffer.copyFrom(ch, 0, in.data(), kBlock);
    const auto start = std::chrono::steady_clock::now();
    proc.processBlock(buffer, midi);
    worstBlockMs = std::max(worstBlockMs, millisSince(start));
  }
  saver.join();

  std::printf("  %zu MB state save: %.1f ms, worst concurrent callback %.2f ms\n", savedBytes >> 20,
              saveMs, worstBlockMs);
  ASSERT_GT(savedBytes, kExtraModels * kExtraModelBytes) << "models weren't embedded";
  // Holding the lock across the copy stalled a callback for most of a save
  // (tens of ms). A generous fraction keeps scheduler noise from flaking.
  EXPECT_LT(worstBlockMs, saveMs / 4.0)
      << "processBlock stalled " << worstBlockMs << " ms during a " << saveMs << " ms save";
}

TEST(StateSaveTest, EmbeddedModelsRoundTripByteForByte) {
  ChainTestProcessor proc;
  proc.restoreFromTree(makeHeavyRigState());
  ASSERT_TRUE(waitForChainLoaded(proc));

  juce::MemoryBlock saved;
  proc.getStateInformation(saved);

  ChainTestProcessor reopened;
  reopened.setStateInformation(saved.getData(), static_cast<int>(saved.getSize()));
  ASSERT_TRUE(waitForChainLoaded(reopened));

  juce::MemoryBlock resaved;
  reopened.getStateInformation(resaved);
  EXPECT_TRUE(saved == resaved) << "state did not survive a save/reopen/save cycle intact";
}
