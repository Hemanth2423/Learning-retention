# Prompt log — PLAN.md

## Prompt 1 (me → Claude Code)
> I want to build an app for learning retention. I don't think a book is the right visual medium for retention. V1: upload a document (book/slides) and have the LLM create (1) a mind map of high-level concepts, (2) a breakdown into key topics with key info shown visually and real-life examples fetched from the internet, (3) a short test per chapter recorded as concept-check progress, (4) a realistic view of what I've learned plus next steps with real resources. V2: teach a concept to the AI and have it correct me Socratically. Let's start with a very short plan.

## Decisions I made when the agent asked
- Stack: Next.js + **Convex** (my choice over Supabase) + Vercel
- LLM: **DeepSeek API**
- Git flow: repo + PLAN PR first, then one branch per feature
- Stars: on **topics**, not whole courses

## Agent response (summary)
Drafted PLAN.md. Pointed out that DeepSeek can't read PDFs or search the web, so the plan adds `unpdf` (PDF → text) and the Tavily Search API (real examples and resource links).
