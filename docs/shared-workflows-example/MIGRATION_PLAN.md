# GitHub Actions Consolidation - Migration Plan

## 📋 Executive Summary

This plan consolidates GitHub Actions workflows from multiple repositories into reusable, parameterized workflows that reduce duplication while maintaining flexibility for repo-specific needs.

## 🎯 Goals

1. **Reduce Duplication**: Single source of truth for common CI/CD patterns
2. **Maintain Flexibility**: Support repo-specific configurations
3. **Zero Downtime**: Gradual migration without breaking deployments
4. **Improved Security**: Centralized secret management
5. **Better Maintainability**: Easier updates across all repos

## 🏗️ Architecture

### Shared Workflows Repository Structure

```
orgname/shared-workflows/
├── .github/
│   └── workflows/
│       ├── ci-base.yml          # Basic CI (lint, build)
│       ├── test-suite.yml       # Comprehensive testing
│       ├── deploy-ssh.yml       # SSH-based deployment
│       └── pr-checks.yml        # PR validation
```

### Repository-Specific Workflows

Each repository maintains thin wrapper workflows that call the shared ones:

```
repo/.github/workflows/
├── ci.yml      # Calls shared CI with repo-specific params
└── deploy.yml  # Calls shared deploy with repo-specific params
```

## 🔑 Key Design Decisions

### 1. Parameterization Strategy

**What's Parameterized:**
- Node.js version (default: 20, master uses 18)
- Test suites to run (unit, integration, E2E)
- Service dependencies (PostgreSQL, Redis)
- Build environment variables
- Deployment paths and users
- Health check endpoints

**What Remains Fixed:**
- Core workflow structure
- Security best practices
- Artifact handling
- Error reporting

### 2. Security Considerations

**Secrets Management:**
- Repository-level secrets for deployment credentials
- Organization-level secrets for shared resources
- No secrets in workflow files
- Minimal permission scopes

**Access Control:**
- Shared workflows in public repo or internal org repo
- Protected branches for workflow changes
- Required reviews for workflow modifications

### 3. Service Dependencies

**Flexible Service Configuration:**
```yaml
services: 'postgres,redis'  # Can be customized per repo
```

**Database Setup:**
- Automatic Prisma detection and setup
- Conditional seeding based on file existence
- Support for different database configurations

## 📝 Migration Steps

### Phase 1: Setup Shared Workflows Repository (Week 1)

1. **Create Repository**
   ```bash
   # Create new repository: orgname/shared-workflows
   gh repo create orgname/shared-workflows --public
   ```

2. **Add Shared Workflows**
   - Copy the 4 reusable workflows
   - Test with a sample repository
   - Document parameters

3. **Set Up Access**
   - Configure branch protection
   - Add CODEOWNERS file
   - Set up required reviews

### Phase 2: Migrate Master Repository (Week 2)

1. **Test in Feature Branch**
   ```bash
   git checkout -b feat/shared-workflows
   # Update .github/workflows/ci.yml and deploy.yml
   ```

2. **Gradual Rollout**
   - Deploy to staging first
   - Monitor for 24 hours
   - Deploy to production

3. **Cleanup**
   - Remove duplicated logic
   - Update documentation

### Phase 3: Migrate WMS Repository (Week 3)

1. **Handle Complex Tests**
   - Ensure all test types work
   - Verify E2E browser matrix
   - Test performance suite

2. **Database Migrations**
   - Test Prisma migrations
   - Verify seed scripts
   - Check service containers

3. **Production Deployment**
   - Coordinate with team
   - Have rollback plan ready

### Phase 4: Extend to Other Repos (Week 4+)

1. **HRMS Repository**
   - Adapt for HRMS-specific needs
   - Add any missing parameters

2. **Other Services**
   - FCC, Jason, MarginMaster
   - Each with specific requirements

## 🚨 Risk Mitigation

### 1. Rollback Strategy

**Immediate Rollback:**
- Keep original workflows for 30 days
- Can revert with single commit
- No infrastructure changes needed

**Gradual Rollback:**
```yaml
# In case of issues, override shared workflow
jobs:
  ci:
    # uses: orgname/shared-workflows/.github/workflows/ci-base.yml@main
    uses: ./.github/workflows/ci-legacy.yml  # Local fallback
```

### 2. Testing Strategy

**Pre-Migration Testing:**
1. Create test repository
2. Implement all workflow types
3. Run for 1 week minimum
4. Document any issues

**Migration Testing:**
- Test on feature branches first
- Run parallel workflows initially
- Compare outputs and timing

### 3. Monitoring

**Key Metrics:**
- Build times
- Success rates
- Deployment frequency
- Error rates

**Alerts:**
- Failed deployments
- Increased build times
- Security scan failures

## 📊 Success Metrics

1. **Reduction in Duplicate Code**: Target 70% reduction
2. **Update Speed**: Single update propagates to all repos
3. **Build Time**: No increase (target: 10% improvement)
4. **Deployment Reliability**: Maintain 99%+ success rate

## 🔧 Maintenance Plan

### Regular Updates

**Weekly:**
- Review workflow runs
- Update dependencies
- Address security alerts

**Monthly:**
- Workflow optimization
- Parameter additions
- Documentation updates

**Quarterly:**
- Major version updates
- Architecture review
- Team training

### Version Strategy

```yaml
# Repos can pin to specific versions
uses: orgname/shared-workflows/.github/workflows/ci-base.yml@v1.0.0
# Or track main for latest
uses: orgname/shared-workflows/.github/workflows/ci-base.yml@main
```

## 🎓 Team Training

1. **Documentation**
   - Parameter reference
   - Migration guide
   - Troubleshooting guide

2. **Workshops**
   - How to use shared workflows
   - How to extend workflows
   - Debugging techniques

3. **Support**
   - Slack channel for questions
   - Office hours during migration
   - Pair programming sessions

## 📅 Timeline

| Week | Phase | Tasks |
|------|-------|-------|
| 1 | Setup | Create shared repo, add workflows |
| 2 | Master Repo | Migrate, test, deploy |
| 3 | WMS Repo | Migrate complex workflows |
| 4 | Other Repos | HRMS, FCC migrations |
| 5 | Optimization | Performance tuning |
| 6 | Documentation | Finalize docs, training |

## ✅ Checklist

- [ ] Create shared workflows repository
- [ ] Implement 4 core workflows
- [ ] Set up repository access controls
- [ ] Create migration branches for each repo
- [ ] Test shared workflows extensively
- [ ] Document all parameters
- [ ] Train team members
- [ ] Migrate master repository
- [ ] Migrate WMS repository
- [ ] Monitor and optimize
- [ ] Extend to remaining repositories
- [ ] Archive legacy workflows

## 🚀 Getting Started

1. **For Repository Owners:**
   ```bash
   # Clone the examples
   cp shared-workflows-example/master-repo/*.yml .github/workflows/
   # Customize parameters
   # Test in feature branch
   ```

2. **For DevOps Team:**
   - Review shared workflows
   - Set up monitoring
   - Prepare rollback plans

3. **For Developers:**
   - Review new workflow syntax
   - Understand parameters
   - Report any issues

## 📚 Additional Resources

- [GitHub Reusable Workflows Docs](https://docs.github.com/en/actions/using-workflows/reusing-workflows)
- [Workflow Syntax Reference](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)
- [Security Best Practices](https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions)