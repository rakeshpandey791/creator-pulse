const UNSUPPORTED_CLAIM_PATTERN =
  /100\s*%|सौ प्रतिशत|पक्का|guarantee|guaranteed|risk[- ]free/i;

export function evaluateFixture(fixture, detectLanguage) {
  const goldenResults = fixture.goldenCases.map((sample) => {
    const detection = detectLanguage(sample.output, sample.language);
    const durationCompliant = isDurationCompliant(
      sample.durationSeconds,
      fixture.targetDurationSeconds,
    );
    const unsupportedClaim = UNSUPPORTED_CLAIM_PATTERN.test(sample.output);
    return {
      caseId: sample.id,
      language: sample.language,
      niche: sample.niche,
      platform: sample.platform,
      languagePass:
        detection.language === sample.detectedLanguage &&
        !detection.scriptMismatch,
      durationCompliant,
      safetyPass: sample.safetyFlags.length === 0,
      unsupportedClaim,
      detection,
    };
  });

  const regressionResults = fixture.regressionCases.map((sample) => {
    const detection = detectLanguage(sample.output, sample.language);
    const detectedUnsupportedClaim = UNSUPPORTED_CLAIM_PATTERN.test(
      sample.output,
    );
    const reviewFlags = detectedUnsupportedClaim ? ["unsupported_claim"] : [];
    const durationCompliant =
      sample.durationSeconds === undefined
        ? null
        : isDurationCompliant(
            sample.durationSeconds,
            fixture.targetDurationSeconds,
          );
    return {
      caseId: sample.id,
      mixedLanguagePass:
        sample.expectedMixedLanguage === undefined ||
        detection.mixedLanguage === sample.expectedMixedLanguage,
      unsupportedClaimPass:
        sample.expectedUnsupportedClaim === undefined ||
        (detectedUnsupportedClaim &&
          reviewFlags.includes(sample.requiredReviewFlag)),
      durationPass:
        sample.expectedDurationCompliant === undefined ||
        durationCompliant === sample.expectedDurationCompliant,
      reviewFlags,
      detection,
      durationCompliant,
    };
  });

  const humanReview = evaluateHumanReview(fixture);
  const rates = {
    goldenLanguagePassRate: rate(goldenResults, "languagePass"),
    durationComplianceRate: rate(goldenResults, "durationCompliant"),
    safetyPassRate: rate(goldenResults, "safetyPass"),
    mixedLanguageFlagRate: rate(regressionResults, "mixedLanguagePass"),
    unsupportedClaimReviewRate: rate(regressionResults, "unsupportedClaimPass"),
    regressionDurationRate: rate(regressionResults, "durationPass"),
    humanReviewPassRate: humanReview.passRate,
  };
  const thresholdResults = Object.fromEntries(
    Object.entries(fixture.thresholds).map(([name, threshold]) => [
      name,
      { actual: rates[name], threshold, passed: rates[name] >= threshold },
    ]),
  );
  const failedThresholds = Object.entries(thresholdResults)
    .filter(([, result]) => !result.passed)
    .map(([name]) => name);

  const report = {
    version: fixture.version,
    generatedAt: new Date().toISOString(),
    rates,
    thresholds: thresholdResults,
    failedThresholds,
    goldenResults: goldenResults.map((result) => ({
      ...result,
      detectedLanguage: result.detection.language,
      scripts: result.detection.scripts,
    })),
    regressionResults: regressionResults.map((result) => ({
      ...result,
      detectedLanguage: result.detection.language,
      scripts: result.detection.scripts,
    })),
    humanReview,
    byContext: buildContextReport(fixture, goldenResults, humanReview),
  };
  return report;
}

function evaluateHumanReview(fixture) {
  const dimensions = fixture.humanReview.dimensions;
  const byCase = new Map();
  for (const review of fixture.humanReview.scores) {
    const values = dimensions.map((dimension) => review.scores[dimension]);
    const valid = values.every(
      (value) => Number.isInteger(value) && value >= 1 && value <= 5,
    );
    if (!valid) throw new Error(`${review.caseId}: invalid human-review score`);
    const entry = byCase.get(review.caseId) ?? [];
    entry.push(review);
    byCase.set(review.caseId, entry);
  }
  const cases = fixture.goldenCases.map((sample) => {
    const reviews = byCase.get(sample.id) ?? [];
    const averages = Object.fromEntries(
      dimensions.map((dimension) => [
        dimension,
        average(reviews.map((review) => review.scores[dimension])),
      ]),
    );
    const allMinimum = dimensions.every(
      (dimension) => averages[dimension] >= fixture.humanReview.minimumScore,
    );
    const disagreement = dimensions.some((dimension) => {
      const scores = reviews.map((review) => review.scores[dimension]);
      return scores.length > 1 && Math.max(...scores) - Math.min(...scores) > 1;
    });
    const escalated =
      reviews.length < fixture.humanReview.reviewersRequired ||
      dimensions.some((dimension) =>
        reviews.some((review) => review.scores[dimension] < 3),
      ) ||
      disagreement;
    return {
      caseId: sample.id,
      language: sample.language,
      reviewerCount: reviews.length,
      averages,
      passed: allMinimum && !escalated,
      escalated,
    };
  });
  return {
    requiredReviewers: fixture.humanReview.reviewersRequired,
    minimumScore: fixture.humanReview.minimumScore,
    passRate: rate(cases, "passed"),
    cases,
  };
}

function buildContextReport(fixture, goldenResults, humanReview) {
  return Object.fromEntries(
    fixture.goldenCases.map((sample) => {
      const golden = goldenResults.find(
        (result) => result.caseId === sample.id,
      );
      const review = humanReview.cases.find(
        (result) => result.caseId === sample.id,
      );
      return [
        `${sample.language}/${sample.niche}/${sample.platform}`,
        {
          language: sample.language,
          niche: sample.niche,
          platform: sample.platform,
          languagePassRate: golden?.languagePass ? 1 : 0,
          durationComplianceRate: golden?.durationCompliant ? 1 : 0,
          humanReviewPassRate: review?.passed ? 1 : 0,
          reviewerCount: review?.reviewerCount ?? 0,
        },
      ];
    }),
  );
}

function isDurationCompliant(seconds, target) {
  return seconds >= target.min && seconds <= target.max;
}

function average(values) {
  return values.length
    ? values.reduce((total, value) => total + value, 0) / values.length
    : 0;
}

function rate(items, property) {
  return items.length
    ? items.filter((item) => item[property]).length / items.length
    : 0;
}
