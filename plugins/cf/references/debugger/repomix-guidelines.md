# Codebase Synthesis (Repomix Guidelines)

Repomix is extreme nuclear option for rapidly understanding the macro-architecture of an unfamiliar project. However, the resulting generated file (`repomix-output.xml`) is extraordinarily massive. You must exercise extreme discipline when generating and utilizing it.

## 1. When to Pull the Trigger on Repomix
- When operating in an entirely foreign codebase with scattered abstractions.
- When an issue requires understanding dependencies across multiple disparate files (e.g. routing logic, controllers, models, and shared utilities).
- DO NOT use Repomix if you only need to fix a localized CSS glitch or a straightforward syntax error within a single file. Rely heavily on specialized `Grep/Glob/Read` tactics first.

## 2. Execution Protocol
When deploying Repomix, execute it using Bash. Ensure you exclude non-essential boilerplate to save tokens:
```bash
npx repomix --ignore "node_modules,dist,build,**/*.test.js,coverage"
```

## 3. Mandatory Distillation Step
Once `repomix-output.xml` is generated, **DO NOT** attempt to read the entire file sequentially using the `Read` tool. It will overflow your Context Window instantly.
- Use `Grep` to extract only the XML tags relevant to your current target.
- Immediately distill the findings into a much leaner `./codebase-summary.md` artifact (if instructed to do so), retaining only the structural map of the core logic routes, rather than the raw code.
- Clean up the `repomix-output.xml` (delete it) after you have extracted the essence to maintain a pristine environment.
