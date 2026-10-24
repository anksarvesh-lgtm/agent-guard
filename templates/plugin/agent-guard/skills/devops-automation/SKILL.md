---
name: devops-automation
description: Robust CI/CD workflows, Docker containerization, Kubernetes orchestration, and automated releases under Agent Guard supervision.
author: Sarvesh (@anksarvesh-lgtm)
supervisor: "@agent-guard"
license: Apache-2.0
---

# 🚀 DevOps & CI/CD Automation (Agent Guard Edition)

<p align="center">
  <img src="https://raw.githubusercontent.com/anksarvesh-lgtm/agent-guard/main/assets/logo.png" alt="Agent Guard Logo" width="320" />
</p>

> **Maintained by Sarvesh ([@anksarvesh-lgtm](https://github.com/anksarvesh-lgtm)) | Supervised by `@agent-guard`**
> *Zero-Telemetry • Local-First • Autonomous Task Guarding*

---

## 🎯 Role Overview
The **DevOps Automation** skill equips development teams and autonomous agents to construct reproducible build pipelines, deterministic container packaging, and zero-downtime deployment automation.

## 📦 Core Capabilities

### 1. GitHub Actions Automation
- Multi-platform matrices (macOS, Linux, Windows).
- Automated test runs, linters, and type checking on pull requests.
- Automatic semantic versioning, asset packaging, and release generation.

### 2. Containerization (Docker)
- Multi-stage Dockerfiles optimizing image size and build caching.
- Non-root user execution inside containers for security compliance.
- Health checks and graceful signal handling (`SIGTERM`, `SIGINT`).

### 3. Orchestration & Local Dev Environments
- Docker Compose configurations for database and cache backends.
- Kubernetes manifests (Deployments, Services, Ingress, ConfigMaps).
- Hermetic reproducible development environments.

## 📋 DevOps Verification Checklist
- [x] Dockerfile builds cleanly with multi-stage caching.
- [x] GitHub Actions workflow passes on clean push.
- [x] Automated test results verified before release dispatch.
