# Language policy

CreatorPulse supports Hindi, Hinglish, Bhojpuri, Punjabi, Haryanvi, Telugu and Kannada through the shared `@creator-pulse/contracts` catalog.

- An explicitly requested language takes precedence over profile languages; otherwise the first selected profile language is used.
- Unsupported language identifiers are rejected with a clear validation error. The system never silently substitutes English.
- Generation requests carry the selected language, dialect, script, platform and explicit-fallback policy.
- Output checks report detected language, scripts, mixed-language output and script mismatch so callers can request correction or an explicit fallback.
- Hinglish is the only launch language with controlled Latin-script Hindi-English code-switching enabled by default.
