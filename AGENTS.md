<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Define typography weight defaults in the global design system so text readability remains consistent across every page.
- Use the shared Button component for billing actions, with compact or unstyled sizes for dense toolbars and bill rows; this preserves consistent focus and disabled states without stretching commands.
- Keep final-amount reverse pricing in a validated pure helper and save derived item rates through the existing bill calculation path so printed and saved totals share the same source of truth.
- Keep rack browsing on its own authenticated page while material and rack-location editing stays in the Stock workflow, so staff can locate stock without expanding edit permissions.
