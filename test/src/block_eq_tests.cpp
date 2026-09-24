// BlockEq tests
//
// The EQ view draws its curve from ui/src/components/eqMath.ts, a TypeScript
// mirror of BlockEq's biquad math, and promises that the drawn curve is the
// audio truth. Both sides are pinned to one golden file,
// test/files/eq_response_golden.json: here the real filter is driven with
// sines and measured, and ui/src/components/eqMath.test.ts evaluates the TS
// mirror against the same numbers. Changing the math on one side only fails
// that side's suite.
//
//   BlockEqGoldenTest  measured magnitude response of every golden case
//                      (cuts, shelves, bells, inert-band skip, the 0.49 fs
//                      clamp, an oversampled rate) matches expectedDb.
//   BlockEqTest        band-role coercion, parameter clamping, bypass, and
//                      a ValueTree round trip.
#include "BlockEq.h"
#include "test_helpers.h"

#include <gtest/gtest.h>
#include <juce_audio_basics/juce_audio_basics.h>

#include <algorithm>
#include <array>
#include <vector>

namespace {

constexpr int kBlock = 512;

struct GoldenCase {
  juce::String name;
  double sampleRate{};
  std::array<BlockEq::Band, BlockEq::kNumBands> bands{};
  std::vector<double> probesHz;
  std::vector<double> expectedDb;
};

std::vector<double> readNumbers(const juce::var& obj, const char* key) {
  std::vector<double> out;
  if (const auto* arr = obj.getProperty(key, {}).getArray())
    for (const auto& x : *arr)
      out.push_back(static_cast<double>(x));
  return out;
}

std::vector<GoldenCase> loadGoldenCases() {
  const auto parsed = juce::JSON::parse(testFile("eq_response_golden.json"));
  std::vector<GoldenCase> cases;
  if (const auto* list = parsed.getProperty("cases", {}).getArray()) {
    for (const auto& v : *list) {
      GoldenCase c;
      c.name = v.getProperty("name", {}).toString();
      c.sampleRate = v.getProperty("sampleRate", 0.0);
      if (const auto* bands = v.getProperty("bands", {}).getArray()) {
        for (int i = 0; i < juce::jmin(bands->size(), BlockEq::kNumBands); ++i) {
          const auto& b = bands->getReference(i);
          c.bands[static_cast<size_t>(i)] = {
              BlockEq::bandTypeFromString(b.getProperty("type", {}).toString()),
              static_cast<float>(static_cast<double>(b.getProperty("freqHz", 0.0))),
              static_cast<float>(static_cast<double>(b.getProperty("gainDb", 0.0))),
              static_cast<float>(static_cast<double>(b.getProperty("q", 0.0)))};
        }
      }
      c.probesHz = readNumbers(v, "probesHz");
      c.expectedDb = readNumbers(v, "expectedDb");
      cases.push_back(std::move(c));
    }
  }
  return cases;
}

// Gain in dB of `eq` at `freq`: a stereo sine streamed through in host-sized
// blocks, one second of settling, then a one-second window (an integer
// number of cycles for integer probe frequencies) measured on both channels.
// A flat EQ is skipped by callers exactly as the chain skips it.
double measureGainDb(BlockEq& eq, double freq, double fs) {
  const int window = static_cast<int>(fs);
  const int total = 2 * window;
  const auto in = makeSine(total, freq, 0.5f, fs);

  juce::AudioBuffer<float> buf(2, kBlock);
  std::vector<float> outL(static_cast<size_t>(total)), outR(static_cast<size_t>(total));
  for (int pos = 0; pos < total; pos += kBlock) {
    const int n = juce::jmin(kBlock, total - pos);
    buf.setSize(2, n, false, false, true);
    for (int ch = 0; ch < 2; ++ch)
      buf.copyFrom(ch, 0, in.data() + pos, n);
    if (eq.isActive())
      eq.process(buf);
    std::copy_n(buf.getReadPointer(0), n, outL.data() + pos);
    std::copy_n(buf.getReadPointer(1), n, outR.data() + pos);
  }

  const auto measured = [&](const std::vector<float>& x) {
    return goertzelPower(x.data() + window, static_cast<size_t>(window), freq, fs);
  };
  const double inPower = measured(in);
  EXPECT_NEAR(db(measured(outL)), db(measured(outR)), 1e-6) << "channels diverge at " << freq;
  return db(measured(outL) / inPower);
}

}  // namespace

TEST(BlockEqGoldenTest, MeasuredResponseMatchesSharedGolden) {
  const auto cases = loadGoldenCases();
  ASSERT_GE(cases.size(), 10u) << "golden file failed to parse";

  for (const auto& c : cases) {
    SCOPED_TRACE(c.name.toStdString());
    ASSERT_EQ(c.probesHz.size(), c.expectedDb.size());

    BlockEq eq;
    eq.prepare(c.sampleRate);
    for (int i = 0; i < BlockEq::kNumBands; ++i)
      ASSERT_TRUE(eq.setBand(i, c.bands[static_cast<size_t>(i)]));

    for (size_t p = 0; p < c.probesHz.size(); ++p) {
      // Float biquads measured with a double DFT: well under 0.01 dB in the
      // passband; deep stopband readings get a proportional allowance.
      const double expected = c.expectedDb[p];
      const double tolerance = juce::jmax(0.01, 0.002 * std::abs(expected));
      EXPECT_NEAR(measureGainDb(eq, c.probesHz[p], c.sampleRate), expected, tolerance)
          << "at " << c.probesHz[p] << " Hz";
    }
  }
}

TEST(BlockEqTest, BandRolesCoerceByPosition) {
  using T = BlockEq::BandType;
  EXPECT_EQ(BlockEq::coerceTypeForBand(0, T::LowCut), T::LowCut);
  EXPECT_EQ(BlockEq::coerceTypeForBand(0, T::Bell), T::LowShelf);
  EXPECT_EQ(BlockEq::coerceTypeForBand(0, T::HighCut), T::LowShelf);
  EXPECT_EQ(BlockEq::coerceTypeForBand(3, T::LowCut), T::Bell);
  EXPECT_EQ(BlockEq::coerceTypeForBand(5, T::HighCut), T::HighCut);
  EXPECT_EQ(BlockEq::coerceTypeForBand(5, T::LowShelf), T::HighShelf);
}

TEST(BlockEqTest, SetBandClampsToPublishedRanges) {
  BlockEq eq;
  eq.prepare(kFs);
  ASSERT_TRUE(eq.setBand(2, {BlockEq::BandType::Bell, 5.0f, 40.0f, 0.0f}));
  EXPECT_FALSE(eq.setBand(-1, {}));
  EXPECT_FALSE(eq.setBand(BlockEq::kNumBands, {}));

  const auto band = eq.toVar().getProperty("bands", {})[2];
  EXPECT_FLOAT_EQ(static_cast<float>(static_cast<double>(band.getProperty("freqHz", 0.0))),
                  BlockEq::kMinFreqHz);
  EXPECT_FLOAT_EQ(static_cast<float>(static_cast<double>(band.getProperty("gainDb", 0.0))),
                  BlockEq::kMaxAbsGainDb);
  EXPECT_FLOAT_EQ(static_cast<float>(static_cast<double>(band.getProperty("q", 0.0))),
                  BlockEq::kMinQ);
}

TEST(BlockEqTest, FlatOrBypassedEqIsInactive) {
  BlockEq eq;
  eq.prepare(kFs);
  EXPECT_FALSE(eq.isActive()) << "defaults are all 0 dB";

  ASSERT_TRUE(eq.setBand(1, {BlockEq::BandType::Bell, 250.0f, 0.04f, 1.0f}));
  EXPECT_FALSE(eq.isActive()) << "a bell under 0.05 dB is inert";

  ASSERT_TRUE(eq.setBand(0, {BlockEq::BandType::LowCut, 80.0f, 0.0f, 0.71f}));
  EXPECT_TRUE(eq.isActive()) << "a cut shapes at any gain";

  eq.setEnabled(false);
  EXPECT_FALSE(eq.isActive());
  eq.setEnabled(true);
  EXPECT_TRUE(eq.isActive());
}

TEST(BlockEqTest, ValueTreeRoundTripPreservesEveryField) {
  BlockEq a;
  a.prepare(kFs);
  a.setBand(0, {BlockEq::BandType::LowCut, 70.0f, 0.0f, 1.3f});
  a.setBand(3, {BlockEq::BandType::Bell, 1800.0f, -6.5f, 2.2f});
  a.setBand(5, {BlockEq::BandType::HighCut, 9500.0f, 0.0f, 0.8f});
  a.setPre(true);
  a.setEnabled(false);

  BlockEq b;
  b.prepare(kFs);
  b.restoreFromValueTree(a.toValueTree());
  EXPECT_TRUE(juce::JSON::toString(a.toVar()) == juce::JSON::toString(b.toVar()))
      << juce::JSON::toString(b.toVar()).toStdString();
  EXPECT_TRUE(b.isPre());
  EXPECT_FALSE(b.isEnabled());
}
