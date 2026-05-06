# Troubleshooting

Common issues and solutions for DClaw Doc.

## Quick Diagnostics

```bash
# Check app pods
kubectl get pods -n dclaw-doc

# Check logs
kubectl logs -n dclaw-doc deployment/dclaw-doc-backend

# Check database
kubectl get clusters -n dclaw-doc
```

## Sections

- [Common Issues](./common-issues)
- [FAQ](./faq)
