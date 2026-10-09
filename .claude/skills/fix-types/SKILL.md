---
name: fix-types
description: Find and fix all type safety issues including any types, type assertions, ts-ignore comments, and missing type annotations. Use to harden type safety across a file or module.
---

# Fix Types

Systematically find and fix all type safety violations in the target code, replacing `any` with proper types, removing unsafe assertions, and adding missing annotations.

## Steps

1. **Scan for Violations**
   - Search for `any` keyword (explicit `any` type annotations, `z.any()`, `Record<string, any>`)
   - Search for `as` type assertions (`value as Type`, `<Type>value`)
   - Search for `@ts-ignore` and `@ts-expect-error` comments
   - Search for `// eslint-disable` comments related to type rules
   - Search for functions missing parameter or return type annotations
   - Search for `z.any()` in Zod schemas
   - Run `tsc --noEmit` to find all compiler errors

2. **Fix `any` Types**

   Replace each `any` with the most specific correct type:

   ```typescript
   // BAD
   function process(data: any): any {}
   const items: any[] = []
   const config: Record<string, any> = {}

   // GOOD
   function process(data: WidgetInput): WidgetOutput {}
   const items: Widget[] = []
   const config: Record<string, unknown> = {}
   ```

   Strategies for replacing `any`:
   - **Known shape**: Define an interface or type alias
   - **Unknown external data**: Use `unknown` + type guards or Zod `.parse()`
   - **Mongoose documents**: Use model's document type or `InferRawDocType`
   - **Zod schemas**: Use `z.infer<typeof schema>` for inferred types
   - **Generic containers**: Use `Record<string, unknown>` instead of `Record<string, any>`
   - **Callback parameters**: Type the specific callback signature
   - **Error catches**: Use `unknown` and narrow: `if (error instanceof Error)`

3. **Fix Type Assertions**

   ```typescript
   // BAD
   const user = result as User
   const data = (response as any).data

   // GOOD — Zod runtime validation
   const user = userSchema.parse(result)

   // GOOD — Type guard
   function isUser(value: unknown): value is User {
     return typeof value === 'object' && value !== null && 'id' in value
   }
   if (isUser(result)) {
     /* result is User here */
   }

   // ACCEPTABLE — Mongoose .lean() or .toObject() where schema guarantees the shape
   const user = (await User.findById(id).lean()) as UserDoc | null
   ```

4. **Fix @ts-ignore / @ts-expect-error**
   - For each instance, understand WHY the type error exists
   - Fix the underlying type issue rather than suppressing it
   - If the error is in a third-party library's types, file an issue and use a properly typed wrapper function instead

5. **Fix Zod Schemas**

   ```typescript
   // BAD
   const schema = z.object({
     data: z.any(),
     items: z.array(z.any()),
   })

   // GOOD
   const schema = z.object({
     data: z.record(z.string(), z.unknown()),
     items: z.array(itemSchema),
   })

   // ALWAYS export inferred type
   export type SchemaInput = z.infer<typeof schema>
   ```

6. **Add Missing Annotations**

   ```typescript
   // BAD — implicit any on parameters, implicit return type
   function processItems(items, options) {}

   // GOOD — explicit types
   function processItems(
     items: Widget[],
     options: ProcessOptions
   ): ProcessResult {}
   ```

7. **Verify Fixes**
   - Run `tsc --noEmit` (or `bun run typecheck`) — must produce zero errors
   - Run existing tests — all must still pass
   - Check that no new `any` was introduced as a "fix"

## Checklist

- [ ] Zero `any` types remaining in the target files
- [ ] Zero `as` assertions without documented justification
- [ ] Zero `@ts-ignore` or `@ts-expect-error` comments
- [ ] Zero `z.any()` in Zod schemas
- [ ] All functions have explicit parameter and return types
- [ ] All Zod schemas export their inferred types
- [ ] `tsc --noEmit` passes with zero errors
- [ ] All existing tests still pass after type fixes
- [ ] No runtime behavior changed — type fixes are compile-time only
