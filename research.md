# FrontierHuman: research notes

FrontierHuman tests one narrow skill: an agent asks a clarifying question, the human answers tersely ("b", "yeah that", "whatever's simpler"), and the agent must recover the intended action. This file summarizes the research the 20 items are built on.

## 1. Clarification datasets: what people actually ask and answer

- **ClarQ** (Kumar & Black, ACL 2020): ~2M clarifying questions mined from StackExchange post/comment pairs across 173 domains. Real clarification exchanges are short and context-dependent; the answer to a clarifying question often only makes sense against the original post. [arXiv:2006.05986](https://arxiv.org/abs/2006.05986)
- **Qulac / ClariQ** (Aliannejadi et al., SIGIR 2019; ConvAI3 2020): crowdsourced *request → clarifying question → user answer* triples. User answers are frequently elliptical or negative ("No, I want to find out where I can purchase…"), so the system has to merge the answer with the original request rather than read it alone. ClariQ also frames the first decision: *when* to ask at all. [github.com/aliannejadi/ClariQ](https://github.com/aliannejadi/ClariQ)
- **AmbigQA** (Min et al., EMNLP 2020): over half of NQ-Open questions turn out to be ambiguous (entity, event, and time references). Ambiguity is the norm in natural requests, not an edge case. [arXiv:2004.10645](https://arxiv.org/abs/2004.10645)
- **CLAMBER** (Zhang et al., ACL 2024): ~12K queries over a taxonomy of epistemic misalignment, linguistic ambiguity (lexical, semantic), and aleatoric output. Two findings matter here: LLMs "struggle to use contextual cues to clarify pronouns", and chain-of-thought/few-shot prompting can make models *overconfident* about ambiguity. [arXiv:2405.12063](https://arxiv.org/abs/2405.12063)

## 2. Ask-vs-act in coding agents

- **Ambig-SWE** (ICLR 2026; arXiv 2025): an underspecified variant of SWE-bench Verified. Models struggle to tell well-specified from underspecified tasks, but when they *do* interact, resolve rates improve by up to 74% over non-interactive runs. The strongest agents explore the codebase first and ask only what cannot be discovered, keeping questions answerable by the user. [arXiv:2502.13069](https://arxiv.org/abs/2502.13069)
- **Ask or Assume?** (Findings of EMNLP 2026): an uncertainty-aware multi-agent scaffold that separates underspecification detection from execution reaches a 69.4% resolve rate on underspecified SWE-bench, close to fully specified runs, and asks fewer questions on easy tasks. [aclanthology.org/2026.findings-emnlp.15](https://aclanthology.org/2026.findings-emnlp.15.pdf)
- **HumanEvalComm** (Wu & Fard, 2024): HumanEval problems altered to be inconsistent, ambiguous, or incomplete. More than 60% of code-LLM responses still write code instead of asking. [arXiv:2406.00215](https://arxiv.org/abs/2406.00215)
- **ACT: Learning to Clarify** (Chen et al., ICLR 2025): RLHF-tuned assistants "overhedge or implicitly guess users' ground-truth intents rather than asking". Training on contrastive *clarify vs. answer* actions improves multi-turn disambiguation, including in AmbigSQL. [arXiv:2406.00222](https://arxiv.org/abs/2406.00222)
- **STaR-GATE** (Andukuri et al., COLM 2025): a model that learns to ask questions about a user's latent preferences produces responses preferred 72% of the time. Eliciting preferences works only if the answer is then *used*. [arXiv:2403.19154](https://arxiv.org/abs/2403.19154)

## 3. Grounding: why humans answer tersely

- **Clark & Brennan (1991), Clark & Wilkes-Gibbs (1986)**: the *principle of least collaborative effort*. Speakers minimize joint effort and rely on shared context to finish meaning, so short answers are rational. "b" is a complete answer *if* the listener tracks what "b" is bound to. [Grounding in communication (PDF)](https://web.stanford.edu/~clark/1990s/Clark,%20H.H.%20_%20Brennan,%20S.E.%20_Grounding%20in%20communication_%201991.pdf)
- **Grice's maxims** (Quantity, Manner): a hedge or a sarcastic "sure, why not" flouts a maxim on purpose, and the implied meaning is the intended one.
- **Navigating Rifts in Human-LLM Grounding** (Shaikh et al., 2025): in WildChat, MultiWOZ, and Bing Chat logs, people are 3x more likely to clarify and 16x more likely to issue follow-ups than LLMs; early grounding failures cascade into later failures. [arXiv:2503.13975](https://arxiv.org/abs/2503.13975)
- **LLMs Get Lost in Multi-Turn Conversation** (Laban et al., ICLR 2026): an average 39% drop from single-turn to multi-turn underspecified settings over 200K+ simulated conversations. Models "make assumptions in early turns", over-rely on them, and lose constraints stated earlier. [arXiv:2505.06120](https://arxiv.org/abs/2505.06120)

## 4. Failure modes the items target

Distilled from the work above and from common coding-agent transcripts (Cursor, Claude Code, Copilot-style sessions where the agent offers "A or B?"):

| Failure mode | What goes wrong | Evidence |
| --- | --- | --- |
| Wrong ordinal binding | "b" / "the second one" bound to position in the latest sentence instead of the labeled list, or to prose order instead of the numbered recap | ClariQ elliptical answers; CLAMBER contextual-reference weakness |
| Recency over salience | "yeah, fix that" bound to the most recently mentioned item instead of the item under discussion | CLAMBER pronoun findings; Clark & Wilkes-Gibbs referring as a joint act |
| Scope creep / scope shrink | "just fix the bug" read as permission to migrate everything; "while you're in there" read too narrowly | Ambig-SWE assumption errors; HumanEvalComm incomplete specs |
| Dropped earlier constraint | "whatever's simpler" answered without the constraint the user stated 10 turns ago (air-gapped, demo in 20 minutes) | Laban et al. multi-turn degradation |
| Literal reading of hedges/sarcasm | "I guess, if it's needed?" or "oh sure, one more flag" treated as a yes | Grice; ACT overhedging/guessing |
| Over-inference | A plain "leave 'em" turned into extra unrequested work | CLAMBER overconfidence; Ambig-SWE user-burden analysis |
| Ignored repair | "wait, that was supposed to be prod" treated as a new request rather than a correction of the last action | Shaikh et al. grounding acts and repair |

## 5. Design principles for the items

1. **One defensible answer.** Every item has a cue in the context, question, or answer that a careful listener can point to. If two readings were equally plausible, a strong agent should ask again, so those items are excluded.
2. **No trivia.** Domain knowledge is limited to what a working developer knows (what an API contract is, what air-gapped means). The difficulty comes from pragmatics.
3. **Plausible distractors.** Each wrong option is a known failure mode from the table: the literal reading, the over-inference, the recency binding, the dropped constraint.
4. **Some literal answers are right.** A few items reward taking the human at their word, so "always read between the lines" is not a winning strategy.
5. **Baselines.** The *strong agent* reference answers every item from its cue (it is the answer key). The *literal reader* baseline picks the most surface-level reading of each reply, as authored per item (`literal` in `site/data/items.json`).
