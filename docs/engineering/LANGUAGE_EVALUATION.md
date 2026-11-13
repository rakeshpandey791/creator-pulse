# Multilingual evaluation harness

The LANG-02 baseline is versioned in [`evaluation/language-fixtures.v1.json`](../../evaluation/language-fixtures.v1.json). It is provider-independent: the fixture checks run without a model key, while the golden output and review fields are the stable contract that future AI-provider evaluations must satisfy.

## Coverage

The golden set has one 30–60 second sample for each launch language, with representative niche/platform context. Each sample records the prompt, minimal output, expected detected language, expected script, duration, safety flags and unsupported-claim status.

Regression fixtures deliberately cover:

- mixed Hinglish output;
- an unsupported finance claim that must receive an `unsupported_claim` review flag;
- a script outside the 30–60 second duration target.

Run the baseline with:

```bash
npm run test:language-eval
```

The runner evaluates the golden and regression outputs through the shared language detector, calculates each configured pass rate, compares it with `thresholds`, and exits non-zero when any threshold is missed. It writes a JSON report to `.ci-artifacts/language-evaluation.json`, including results grouped by language, niche and platform. This is a release gate; a missing language, script mismatch, duration failure or unreviewed claim fails the run.

## Human review rubric

Two reviewers, including a native speaker for the target language, score each output from 1 to 5 on language fidelity, naturalness, platform fit, safety and unsupported claims. A baseline is acceptable only when every dimension scores at least 4.

The fixture stores two reviewer score sets per golden case. The runner validates score ranges, calculates per-dimension averages, enforces the minimum score, detects reviewer disagreement, and marks escalated cases. Escalate the case when any dimension is below 3, reviewers differ by more than one point, a native reviewer flags dialect/script mismatch, or an unsafe or unsupported claim is not explicitly flagged. Preserve only the fixture ID, language, niche, platform, model/prompt version, scores and review outcome in reports; do not persist full prompts or personal creator data.
