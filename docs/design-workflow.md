# EcoBot Design Workflow (source: hand-drawn flowchart, IMG_8533)

The decision logic the AI tutor guides students through. Loops back on any "No".

1. What do I want to create?
   - (feeds into) → Do the parts exist?
2. Do the parts exist?
   - No  → back to (1) What do I want to create?
   - Yes → Will I be able to code it?
3. Will I be able to code it?
   - No  → back to (1) What do I want to create?
   - Yes → Choose my chassis
4. Choose my chassis  (chassis validation sub-loop)
   - → Is it durable enough?
       - No  → back to Choose my chassis
       - Yes → Weight constraint?
   - → Enough space?
       - No  → back to Choose my chassis
       - Yes → What part models should I buy?
   - Weight constraint?
       - No  → back to Choose my chassis
       - Yes → (continue toward space/parts path)
5. What part models should I buy?
   - → Are they provided by [EcoBot]?
6. Are they provided by [EcoBot]?
   - No  → back to (5) What part models should I buy?
   - Yes → Does it fit within my budget?
7. Does it fit within my budget? (first budget gate)
   - No  → Can I acquire or make an alternative?
   - Yes → Can I acquire or make an alternative? / proceed
8. Can I acquire or make an alternative?
   - No  → back to (5) What part models should I buy?
   - Yes → Does it fit within my budget? (second budget gate)
9. Does it fit within my budget? (second budget gate)
   - Yes → Plan out build process
10. Plan out build process
    - → Does it make sense & is it efficient?
11. Does it make sense & is it efficient?
    - No  → Revise (loop back to Plan out build process)
    - Yes → Begin design process
12. Begin design process → [ ... ] (hand off to build/iterate loop)

## Mapping to Observe → Define → Ideate → Prototype → Test
- Observe:   "What do I want to create?"
- Define:    "Do the parts exist?", "Will I be able to code it?", chassis constraints
- Ideate:    chassis choice, part models, EcoBot-provided vs alternatives
- Prototype: budget gates, "Plan out build process"
- Test:      "Does it make sense & is it efficient?" → revise loop → Begin design process
