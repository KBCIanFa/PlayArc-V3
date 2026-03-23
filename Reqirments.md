Product Requirements: Modern Test Automation Platform

Build a modern test automation platform that can serve as a functional replacement for Katalon for web and API testing, with a mixed-engine architecture using both Playwright and Selenium, a no-code/low-code authoring experience, and a full-code option for advanced users.

The platform must support importing existing Katalon projects as a first-class migration path. Katalon project import is a hard requirement and must be treated as part of the MVP, not a future enhancement.

1. Product Goal

Create an enterprise-ready automation platform that enables QA engineers, SDETs, business testers, and technical users to design, execute, maintain, and analyze automated tests across web and API domains.

The platform must combine:

a code-less and low-code test design experience
a full-code authoring option
mixed execution engines using Playwright and Selenium for web automation
first-class API testing support
modern reporting, debugging, scheduling, CI/CD, analytics, and collaboration features
Katalon project import and migration tooling

The system should feel like a modern automation product, not just a test runner.

2. Core Vision

The platform must be designed around a unified test model rather than tightly coupling all features to a single automation engine.

Internally, tests should be represented in a neutral execution model that can be executed by:

Playwright engine
Selenium engine
API engine

This abstraction is mandatory so that no-code, low-code, and code-based tests can coexist and so that imported Katalon assets can be transformed into the platform’s native representation.

3. Mandatory Scope

The first release must include all of the following:

Web UI test automation
API test automation
Code-less test design
Code-based test authoring
Reusable test components
Data-driven testing
Test suites and test collections
Variable and environment management
Scheduling and CLI execution
Reporting and debugging artifacts
CI/CD integration
Role-based project collaboration
Katalon project import and migration module

Desktop and mobile support may be designed for future extensibility but are not required in MVP unless architecture choices make their future addition straightforward.

4. Hard Requirement: Katalon Import Module

This is a non-negotiable requirement.

The platform must include an import module capable of ingesting Katalon projects and converting them into runnable assets in the new platform.

4.1 Katalon Import Scope

The importer must support, at minimum:

Test cases
Test suites
Test suite collections where feasible
Object repository assets
Global variables
Profiles/environments
Test data files where supported
Custom keywords where feasible
Execution settings where relevant
Folder/project structure
4.2 Import Behavior

The importer must:

Parse Katalon project structures directly
Map supported assets into the platform’s internal model
Preserve folder hierarchy where possible
Preserve naming and metadata where possible
Detect unsupported or partially supported constructs
Generate a migration report with warnings, errors, and manual follow-up actions
Produce runnable imported tests whenever conversion is possible
Allow side-by-side validation of source vs imported assets
4.3 Import Output

For each import, the system must produce:

Imported project structure
Imported objects/locators
Converted test steps or generated code equivalents
Conversion report
Unsupported items report
Suggested remediation actions
Execution compatibility score or confidence indicator
4.4 Import UX

The import workflow must include:

Drag-and-drop or file upload of Katalon project package/folder
Pre-import scan
Compatibility summary
Mapping preview
Conversion execution
Post-import review dashboard
Option to re-run conversion after adjusting mappings
4.5 Import Extensibility

The importer should be plugin-friendly so future support can be added for:

More custom keywords
Edge-case Katalon Groovy logic
Additional asset types
Migration from other tools later
5. Architecture Requirements

The platform must use a modular service-oriented or well-layered modular-monolith architecture with clear separation between:

Authoring/UI layer
Test model and orchestration layer
Execution engine adapters
Reporting and analytics layer
Import/migration layer
Integration layer
Project/configuration storage layer
5.1 Engine Strategy

The web automation layer must support both Playwright and Selenium.

Playwright should be the preferred default engine for:
modern web apps
stable execution
trace/debug artifact generation
multi-browser isolation
modern low-flake automation
Selenium should be included for:
compatibility with legacy web flows
support for existing Selenium-like patterns
enterprise browser/grid compatibility
imported project cases that map better to Selenium execution

The system must allow:

selecting engine at project level
selecting engine at suite level
selecting engine at test level
fallback or migration recommendation logic where applicable
5.2 Unified Test Model

The platform must define a canonical internal test model containing:

Project
Folder
Test case
Test suite
Test suite collection
Step
Action
Assertion
Locator/object
Variable
Data source
Environment/profile
Keyword/function
Hook/setup/teardown
Execution artifact
Result/status
Retry/flakiness metadata

This model must support rendering to both no-code steps and code representations.

6. Test Authoring Requirements
6.1 No-Code / Low-Code Designer

The platform must include a visual test designer that allows users to build tests without writing code.

The designer must support:

step-based test construction
drag-and-drop actions
action configuration forms
assertions
loops and conditions
reusable blocks/components
setup and teardown steps
variable binding
data-driven execution
environment selection
screenshot and checkpoint steps
wait, delay, and synchronization controls
API request design and validation
locator selection and repository linking

The no-code experience must generate or map to the internal test model, not exist as an isolated proprietary layer.

6.2 Recorder

The platform should include a web recorder that can:

capture browser interactions
generate step-based tests
suggest stable locators
allow immediate cleanup/editing of recorded flows
support conversion to code view
support Playwright-first recordings with optional Selenium-compatible mappings where possible
6.3 Full-Code Authoring

The platform must include a code editor mode for technical users.

The coded option must support:

viewing generated code from no-code tests
creating tests directly in code
editing imported converted tests
reusable libraries/modules
custom helper functions
code completion and validation where possible
syntax-aware formatting
version-control-friendly file structures

The platform should support a primary implementation language for internal code generation. A strong default would be TypeScript or JavaScript for Playwright-oriented tests, with compatibility strategy for Selenium-based code.

If supporting multiple languages in MVP adds too much complexity, choose one primary language and ensure architecture can expand later.

6.4 Round-Trip Capability

The platform should support as much round-tripping as possible between:

no-code steps
generated code
imported Katalon assets

Where full round-trip is not possible, the system must clearly indicate the source of truth.

7. Web Testing Requirements

The web testing module must support:

navigation
clicks, typing, selecting, hovering
frames and iframes
popups and multiple tabs/windows
waits and synchronization
alerts/confirmations
file upload/download
screenshots
browser storage/cookies
network request interception where Playwright is used
execution across Chromium, Firefox, and WebKit via Playwright
execution across standard Selenium-supported browsers
headless and headed runs
parallel execution
retries
tagging and filtering
before/after hooks
parameterized tests

The system must manage locator strategies through a shared object repository or locator repository.

8. Locator and Object Repository Requirements

The platform must provide a central object/locator repository with:

support for CSS, XPath, text, role, test-id, and custom selectors
logical naming
foldering and grouping
duplicate detection
stale locator detection
usage tracking
impact analysis for locator changes
recommendation engine for more resilient selectors
support for imported Katalon object repository entries

The platform should prefer resilient locator strategies and guide users away from brittle XPath usage where possible.

9. API Testing Requirements

The platform must include first-class API testing, not just a lightweight add-on.

It must support:

REST APIs
GraphQL requests
common auth methods such as Basic, Bearer, API key, OAuth2 where practical
headers, query params, path params, cookies
JSON, XML, form-data, multipart, raw payloads
response assertions
schema validation
chained requests
variable extraction from responses
environment-based endpoints
reusable request templates
mock/stub support as a future-friendly design consideration
API collections and suites
data-driven API execution

Users must be able to build API tests via:

form-based designer
raw request editor
code mode where needed
10. Reusability and Maintainability Requirements

The platform must support reusable automation building blocks, including:

custom keywords/functions
reusable step groups
shared assertions
shared API request templates
common setup/teardown logic
shared variables and secrets
reusable test data references

Imported Katalon custom keywords should be analyzed and either:

converted automatically where possible
wrapped as custom code modules
flagged with remediation guidance where conversion is not feasible
11. Data-Driven Testing Requirements

The system must support data-driven test execution using:

inline datasets
CSV
JSON
Excel if feasible
environment variables
extracted runtime values
parameter sets defined in UI

Users must be able to:

bind variables to data fields
run one test against multiple rows
filter rows
mask sensitive values in logs
12. Environment and Configuration Management

The platform must support environment/profile management comparable to modern automation tools.

It must include:

base URLs
credentials and secrets references
environment-specific variables
browser settings
API endpoints
execution flags
per-project and per-suite overrides

Sensitive values must not be stored in plaintext by default. Secret handling must support encryption or external secret provider integration in later phases.

13. Execution Requirements

The platform must support:

local execution
CLI execution
scheduled execution
CI-triggered execution
manual execution from UI
parallel execution
distributed execution architecture readiness
rerun failed tests
retries at test and suite level
tag-based and folder-based filtering

Each execution must produce rich artifacts and a normalized result model regardless of engine.

14. Reporting and Debugging Requirements

The reporting layer must be a major feature, not an afterthought.

Each execution should capture:

pass/fail/skipped status
logs
screenshots
console logs where possible
traces for Playwright runs
browser and network diagnostics where possible
request/response details for API tests
timing metrics
retry history
flakiness indicators

The reporting UI must include:

execution summary dashboard
drill-down by test/suite/project
historical trends
pass rate
duration trends
failure clustering
artifact viewer
step-by-step failure inspection
engine used for execution
imported test lineage metadata where applicable
15. Collaboration and Governance Requirements

The platform must support multi-user team usage with:

projects
workspaces or organizations
role-based access control
auditability for key actions
shared repositories
shared environments
execution permissions
import permissions
admin settings

Version control integration should be designed in from the beginning, especially for code artifacts.

16. CI/CD and Integration Requirements

The platform must support integration with common delivery workflows.

Minimum integrations:

Git-based source control
CLI for CI usage
Jenkins
GitHub Actions
Azure DevOps

Preferred additional integrations:

Jira
Xray
webhook notifications
Slack/Teams notifications

The system should expose machine-readable test results and provide APIs for execution and result retrieval.

17. AI-Assisted Features

The product should include AI-assisted capabilities where practical, but AI must not replace deterministic core functionality.

Preferred AI capabilities:

test generation from prompts
locator healing suggestions
failure triage suggestions
conversion assistance for imported Katalon assets
API assertion suggestions
duplicate test detection
flaky test risk hints

All AI-generated outputs must be reviewable and editable by users before execution.

18. Non-Functional Requirements

The platform must be:

modular
extensible
secure
observable
scalable
maintainable
version-control-friendly
18.1 Performance
UI should remain responsive with large projects
execution orchestration should handle many suites and artifacts
import jobs should scale to large Katalon projects
18.2 Security
encrypted secret storage
secure artifact access
RBAC
audit logs for critical operations
safe handling of uploaded project files
18.3 Reliability
deterministic execution state tracking
robust handling of interrupted runs
resumable or restartable import jobs where practical
18.4 Extensibility
plugin-friendly design for future engines
ability to add mobile/desktop later
ability to add additional importers later
19. UX Requirements

The UX must feel like a modern quality engineering tool, not a developer-only framework wrapper.

Key UX modules:

project dashboard
test explorer
no-code designer
code editor
object repository
data manager
environment manager
execution center
reports dashboard
import center
settings and integrations

The system should provide strong visual cues about:

engine selection
unsupported imported features
sync status between no-code and code views
flaky or unstable tests
migration confidence
20. MVP Priority Definition

The MVP must prioritize the following in this order:

Katalon project import
Unified web automation with Playwright and Selenium support
No-code test designer
API testing module
Code mode
Execution engine and CLI
Reporting and debugging artifacts
Environment/data management
CI/CD integration
Collaboration basics

Anything not required for those should be deferred.

21. Acceptance Criteria

The solution will be considered successful if it can do the following:

Import a representative Katalon project and produce a migration report
Convert a substantial portion of supported Katalon assets into runnable native tests
Allow a non-technical user to build and run a web or API test from the no-code interface
Allow a technical user to edit or create tests in code
Execute web tests using either Playwright or Selenium
Execute API tests with assertions and reusable environments
Produce clear execution reports with artifacts
Run from both UI and CLI
Integrate into at least one CI pipeline with machine-readable results
Support reusable objects, variables, and test data
Maintain a clear separation between engine implementations and the platform’s canonical test model
22. Suggested Technical Direction

Use Playwright as the default modern web engine and Selenium as a compatibility engine.

Use an internal abstraction layer so authored tests are not locked to either engine.

For Katalon import, create a dedicated parsing and transformation pipeline with:

project scanner
asset parser
mapping engine
compatibility analyzer
transformer
validation runner
migration reporter

Treat import as a product feature with dedicated UI and diagnostics, not just a backend script.

23. Explicit Build Instruction for Vibe Coding Session

Build a modern Katalon-replacement platform for web and API automation with a mixed-engine execution model using Playwright and Selenium, a code-less visual test designer, full code-based test editing, reusable objects and keywords, data-driven testing, environments, scheduling, CI/CD, rich reports, collaboration basics, and a hard-required Katalon project import module that converts Katalon assets into runnable native tests and provides a detailed migration report.

If you want, I can turn this into a cleaner PRD with sections for user stories, functional requirements, technical architecture, and phased roadmap.

Where is the word doc

I can generate the Word document, but I can’t attach files directly unless I format the content for download. The quickest way is for me to format it so you can paste it directly into Word with proper headings and structure.

If you'd like, I can also provide a .docx-ready version structure (with title page, table of contents headings, and formatting styles) so it drops into Word cleanly.

For now, here is the Word-formatted version. When pasted into Word, the headings will automatically work with Insert → Table of Contents.

Product Requirements Document
Modern Automation Platform (Katalon Replacement)

Version: 1.0
Date: March 2026
Purpose: Requirements for AI-assisted development (“vibe coding”) of a modern automation platform supporting Playwright, Selenium, and API testing with code-less and coded testing capabilities.

1. Product Overview

The goal is to build a modern automation platform capable of replacing Katalon for web and API testing. The platform must support both low-code and full-code test development and allow teams to design, run, manage, and analyze automated tests at scale.

The platform must use a mixed execution model built on Playwright and Selenium while supporting a unified internal test model. The system must provide enterprise-grade reporting, CI/CD integration, test management, and collaboration features.

A Katalon project import module is a mandatory requirement and must be included in the MVP release.

2. Product Objectives

The system must enable the following capabilities:

Code-less test creation for non-technical users
Full code-based test authoring for engineers
Cross-browser web automation
API testing and validation
Reusable test components and objects
Data-driven testing
Environment and configuration management
CI/CD execution
Rich reporting and analytics
Test history and flakiness insights
Collaboration and project management
Migration of existing Katalon projects
3. Core Platform Architecture

The system must use a layered architecture composed of the following components:

Authoring Layer

User-facing interface for creating tests using visual tools or code editors.

Test Model Layer

Internal canonical test representation independent of the execution engines.

Execution Engine Layer

Adapters that translate the test model into executable commands for automation engines.

Reporting & Analytics Layer

Responsible for collecting artifacts, logs, metrics, and analytics.

Import & Migration Layer

Handles ingestion and conversion of external project formats, including Katalon.

Integration Layer

Provides APIs and integrations with CI/CD, issue trackers, and messaging tools.

4. Execution Engines

The platform must support two automation engines.

Playwright Engine

Playwright will be the default engine for modern web automation.

Capabilities include:

Chromium, Firefox, WebKit support
Automatic waiting
Network interception
Browser context isolation
Tracing and debugging
Parallel execution
Selenium Engine

Selenium will serve as the compatibility engine for:

Legacy browser automation
Selenium Grid environments
Compatibility with imported projects
Enterprise browser support

Users must be able to select the execution engine at:

Project level
Test suite level
Individual test level
5. Unified Test Model

All tests must be represented using a unified internal test model containing the following entities:

Project
Folder
Test Case
Test Suite
Test Suite Collection
Step
Assertion
Locator/Object
Variable
Test Data
Environment/Profile
Custom Keyword/Function
Execution Result
Artifact

This abstraction ensures that tests are not tied directly to Playwright or Selenium implementations.

6. Test Authoring
Code-less Test Designer

The system must provide a visual test designer supporting:

Drag-and-drop step construction
Action configuration panels
Assertions
Loops and conditional logic
Variable binding
Data-driven test execution
Reusable step groups
Setup and teardown steps

The designer must generate structured test definitions compatible with the unified test model.

Test Recorder

A web recorder must allow users to capture interactions and convert them into automated tests.

Recorder capabilities include:

Interaction capture
Automatic locator generation
Step generation
Editable recorded flows
Conversion to code
Code-Based Authoring

The system must include a full code editor mode.

Capabilities must include:

Editing generated tests
Writing new tests from scratch
Creating reusable libraries
Importing helper modules
Syntax highlighting
Code formatting

Tests written in code must still integrate with the platform’s reporting and execution systems.

7. Web Automation Capabilities

The platform must support common browser automation tasks including:

Navigation
Element interaction
Form input
Hover and drag actions
Frames and iframes
Multiple windows and tabs
File uploads
Alerts and dialogs
Screenshot capture
Wait and synchronization strategies

The system must support both headless and headed execution.

8. Object Repository

A central object repository must be implemented.

Features must include:

CSS selectors
XPath selectors
Text-based selectors
Role selectors
Test ID selectors

Repository capabilities:

Locator reuse
Usage tracking
Duplicate detection
Impact analysis
Support for imported Katalon object repositories
9. API Testing Module

The platform must provide native API testing functionality.

Supported capabilities include:

REST APIs
GraphQL
Authentication methods
Header and parameter configuration
Request chaining
Response validation
JSON and XML validation
Schema validation
Environment-based endpoints

API tests must support both form-based design and raw request editing.

10. Data-Driven Testing

The system must support data-driven execution using:

CSV
JSON
Excel
Inline datasets
External sources where applicable

Users must be able to bind test variables to dataset fields.

11. Environment and Configuration Management

Environment management must support:

Base URLs
Environment variables
Credentials
API endpoints
Browser configurations

Sensitive data must be securely stored.

12. Test Execution

The platform must support:

Local execution
CLI execution
Scheduled execution
CI-triggered execution
Parallel execution
Retry policies
Tag-based filtering
13. Reporting and Analytics

Each test execution must produce the following artifacts:

Execution status
Logs
Screenshots
Browser traces
Request/response data
Execution timing
Failure diagnostics

Reporting dashboards must include:

Pass/fail rates
Historical trends
Failure clusters
Execution duration analysis
Flaky test detection indicators
14. Collaboration and Access Control

The system must support team-based usage with:

Project workspaces
Role-based access control
Shared test repositories
Shared environment configurations
Audit logs
15. CI/CD Integration

The platform must integrate with common CI/CD systems.

Required integrations include:

Git repositories
Jenkins
GitHub Actions
Azure DevOps

Optional integrations include:

Jira
Xray
Slack
Microsoft Teams
16. AI-Assisted Features

The system may include AI-powered features such as:

Test generation from prompts
Locator healing suggestions
Failure analysis
Test duplication detection
API assertion suggestions
Migration assistance for imported Katalon assets

All AI-generated outputs must remain user-editable.

17. Katalon Project Import Module (Mandatory)

A dedicated import module must be developed to support migration from Katalon.

Import Capabilities

The importer must support:

Test cases
Test suites
Object repositories
Global variables
Profiles
Test data sources
Custom keywords where possible
Import Workflow

The import workflow must include:

Project upload
Pre-import scanning
Compatibility analysis
Asset mapping
Conversion execution
Migration report generation
Post-import validation
Migration Report

Each import must generate a detailed report including:

Converted assets
Unsupported features
Warnings
Suggested remediation steps
Conversion success rate
18. Non-Functional Requirements

The system must satisfy the following requirements:

Performance

Large projects must load and execute efficiently.

Security

Sensitive data must be encrypted and access-controlled.

Reliability

Test executions must be deterministic and resilient to failures.

Extensibility

Architecture must allow future support for:

Mobile testing
Desktop testing
Additional automation engines
19. MVP Scope

The MVP must include:

Katalon import module
Web automation with Playwright and Selenium
Code-less test designer
Code-based editing
API testing
Reporting and execution artifacts
CLI and CI execution
Environment management
Basic collaboration
20. Acceptance Criteria

The system will be considered successful if it can:

Import a Katalon project
Convert a majority of assets into runnable tests
Allow users to create tests using a visual designer
Execute tests using Playwright or Selenium
Run API tests with assertions
Produce detailed execution reports
Run tests via CLI and CI pipelines
Support reusable objects and test data

If you'd like, I can also generate:

a downloadable .DOCX file
a system architecture spec for developers
a technical architecture diagram
a 90-day MVP development roadmap

Those help vibe coding sessions produce far better results because they guide the AI toward a correct architecture. 🚀
