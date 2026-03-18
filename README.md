# MaintAIn-Vacation-E2E

End-to-end tests for the MaintAIn Vacation Management Application using [Playwright](https://playwright.dev/).

## Prerequisites

- **Node.js** ≥ 18
- **Backend** running on `http://localhost:8181`
- **Frontend** running on `http://localhost:5173`

## Setup

```bash
npm install
npx playwright install chromium
```

## Configuration

Test credentials default to `user` / `password`. Override via environment variables:

```bash
TEST_USER=myuser TEST_PASSWORD=mypass npm test
```

## Running Tests

```bash
# Run all tests
npm test

# Run only API tests
npm run test:api

# Run only UI tests
npm run test:ui

# Run in headed mode (see the browser)
npm run test:headed

# View HTML report
npm run report
```

## Test Scenarios

| # | Scenario | Type |
|---|----------|------|
| 1 | Access protected endpoint without auth → 401 | API |
| 2 | Successful authenticated request → 200 | API |
| 3 | Fetch current user profile | API |
| 4 | Create vacation request | API |
| 5 | Verify vacation appears in list | API |
| 6 | Verify remainingVacationDays decreases | API |
| 7 | Login form authenticates and shows dashboard | UI |
| 8 | Dashboard displays remaining vacation days | UI |
| 9 | Create vacation via form, verify list & remaining days | UI |

## Project Structure

```
├── playwright.config.ts        # Playwright configuration
├── tests/
│   ├── helpers/
│   │   └── auth.ts             # Basic Auth helpers & test credentials
│   ├── api/
│   │   └── vacation-api.spec.ts  # API-level test scenarios
│   └── ui/
│       └── vacation-ui.spec.ts   # UI-level test scenarios
```
