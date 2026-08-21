module.exports = {
  ci: {
    collect: {
      staticDistDir: ".",
      url: [
        "http://localhost/index.html",
        "http://localhost/join.html",
        "http://localhost/venues.html",
        "http://localhost/conduct.html"
      ],
      numberOfRuns: 3,
      settings: {
        onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
        chromeFlags: "--headless --no-sandbox --disable-dev-shm-usage"
      }
    },
    assert: {
      assertions: {
        "categories:performance": ["error", { "minScore": 0.85, "aggregationMethod": "median" }],
        "categories:accessibility": ["error", { "minScore": 0.95, "aggregationMethod": "median" }],
        "categories:best-practices": ["error", { "minScore": 0.90, "aggregationMethod": "median" }],
        "categories:seo": ["error", { "minScore": 0.90, "aggregationMethod": "median" }],
        "cumulative-layout-shift": ["error", { "maxNumericValue": 0.10, "aggregationMethod": "pessimistic" }],
        "largest-contentful-paint": ["warn", { "maxNumericValue": 4000, "aggregationMethod": "median" }],
        "total-byte-weight": ["warn", { "maxNumericValue": 512000, "aggregationMethod": "pessimistic" }]
      }
    }
  }
};
