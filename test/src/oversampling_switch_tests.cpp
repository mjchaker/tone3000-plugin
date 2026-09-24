// Oversampling factor switch tests
//
// A NAM engine is built for one oversampling factor: an ×N engine runs N
// phase instances of the model (see plugin/docs/oversampling.md), so it
// can't be re-prepared into another factor, only rebuilt. These pin that
// every path that moves the chain's factor rebuilds mismatched engines:
//
//   - prepareToPlay picking up a new factor (a host restoring an
//     oversampled session re-prepares before the parameter listener's async
//     apply runs; that apply then sees no change and returns early), and
//   - the rebuilt rig sounds identical to one that ran at that factor from
//     the start.
//
// The chain is seeded through the real state path with the model bytes
// embedded, so rebuilds are cache-first and never touch the network.
#include "Processor.h"
#include "chain_test_helpers.h"

#include <gtest/gtest.h>

#include <vector>

namespace {

constexpr int kBlock = 512;

juce::ValueTree makeMonoAmpState() {
  juce::ValueTree state("ChainSnapshot");
  juce::ValueTree left("ChainBlocks");
  left.appendChild(makeNamBlockTree("blk-amp", 1, 100), nullptr);
  state.appendChild(left, nullptr);
  return state;
}

// osFactor is a 3-way choice (2x/4x/8x); normalized 0.5 is index 1 = 4x.
void requestOversampling4x(TONE3000Processor& proc) {
  proc.parameters.getParameter("osEnabled")->setValueNotifyingHost(1.0f);
  proc.parameters.getParameter("osFactor")->setValueNotifyingHost(0.5f);
}

juce::var ampBlock(TONE3000Processor& proc) {
  const juce::var state = proc.getChainState(-1);
  if (const auto* lane = state["chain"].getArray())
    for (const auto& item : *lane)
      if (item["blockId"].toString() == "blk-amp")
        return item;
  return {};
}

}  // namespace

TEST(OversamplingSwitchTest, PrepareToPlayRebuildsEnginesBuiltForAnotherFactor) {
  const auto in = makeSine(2 * 48000, 220.0, 0.3f);

  // Reference: the session was at 4x before the amp ever loaded.
  ChainTestProcessor ref;
  ref.setPlayConfigDetails(2, 2, kFs, kBlock);
  requestOversampling4x(ref);
  ref.prepareToPlay(kFs, kBlock);
  ref.restoreFromTree(makeMonoAmpState());
  ASSERT_TRUE(waitForChainLoaded(ref));
  const auto [refL, refR] = processStereo(ref, in, kBlock);

  // Under test: the amp loads at 1x, then the host re-prepares with the
  // parameters now asking for 4x. The listener's async apply never runs here
  // (no message pump), exactly the window a restoring host opens.
  ChainTestProcessor proc;
  proc.setPlayConfigDetails(2, 2, kFs, kBlock);
  proc.prepareToPlay(kFs, kBlock);
  proc.restoreFromTree(makeMonoAmpState());
  ASSERT_TRUE(waitForChainLoaded(proc));
  ASSERT_TRUE(static_cast<bool>(ampBlock(proc)["loaded"]));

  requestOversampling4x(proc);
  proc.prepareToPlay(kFs, kBlock);
  const juce::var afterPrepare = ampBlock(proc);
  EXPECT_FALSE(static_cast<bool>(afterPrepare["loaded"]) &&
               !static_cast<bool>(afterPrepare["modelLoading"]))
      << "the 1x engine was left running at the 4x chain rate";

  ASSERT_TRUE(waitForChainLoaded(proc));
  const auto [outL, outR] = processStereo(proc, in, kBlock);
  EXPECT_LT(settledMaxChannelDiff(outL, refL), 1e-5f);
  EXPECT_LT(settledMaxChannelDiff(outR, refR), 1e-5f);
}
