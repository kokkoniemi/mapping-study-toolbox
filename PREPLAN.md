The best method is to treat this as **taxonomy induction**, not just keyword extraction.

Use a **hybrid pipeline**: extract clean article text, embed each paper with a **scientific-document embedding model**, discover themes/clusters across the corpus, and then let an LLM decide whether each theme should **reuse an existing category, become a new category, or trigger a split/merge**. BERTopic is a strong fit here because it supports **zero-shot topics** for predefined categories, **semi-supervised guidance** from existing labels, and **hierarchical/topic-reduction** workflows for merges and subtopics. SPECTER2 is specifically built for **scientific document embeddings** and downstream tasks like clustering. ([Maarten G.][1])

Given your setup, the best input is usually **both**: use the **SQLite DB as the source of truth** for article IDs, existing keywords, and mapping questions, and keep the **PDFs as the evidence layer** in case text needs to be re-extracted. For scholarly PDFs, **GROBID** is strong when you want structured title/abstract/sections/references, while **PyMuPDF4LLM** is a lighter option that outputs Markdown/JSON, handles multi-column pages, and supports chunking for LLM workflows. For long papers, do **not** embed the whole PDF as one blob; BERTopic’s own guidance says long documents should be split into sentences or paragraphs before embedding. ([GROBID][2])

The workflow I would recommend is:

1. **Build a per-article evidence pack**
   Title, abstract, author keywords, section headings, conclusion, plus selected body chunks. For systematic mapping work, I would run two parallel views:

   * **independent topical keywords**: “What is this paper about?”
   * **mapping-question keywords**: “What in this paper answers mapping question X?”

2. **Generate candidate keywords in two passes**
   First, run an unconstrained extraction pass to find concepts independently of your current taxonomy. Second, run a taxonomy-aware pass that compares those concepts to your existing categories. **KeyBERT** is a simple embedding-based keyword extractor, and BERTopic can also refine topic keywords with **KeyBERT-inspired** or **LLM-based** topic representations. ([Maarten G.][3])

3. **Discover topics while honoring existing categories**
   Seed BERTopic with your current category list using **zero-shot topic modeling**. Papers that semantically match existing categories keep them; papers that do not match are clustered into **new topics**. If you already trust some old labels, you can also use **semi-supervised** or **guided** topic modeling to nudge the model without forcing everything into the old taxonomy. ([Maarten G.][1])

4. **Use cluster-level decisions for split/merge/create/reuse**
   After clustering, inspect the **hierarchy** of topics to see which categories are near each other and which contain subtopics. BERTopic’s hierarchy and topic-reduction machinery is useful here because it explicitly supports reasoning about **similar topics**, **sub-topics**, and **merging**. ([Maarten G.][4])

5. **Let the LLM adjudicate in a fixed schema**
   For each discovered cluster, ask the model to output something like:
   `cluster_name, reuse_existing?, existing_category, create_new?, new_category_name, split?, merge_with, rationale, evidence_snippets, confidence`
   Using **Structured Outputs** makes this much easier to validate and store because the model can be constrained to a JSON schema. ([OpenAI Developers][5])

The practical decision rules I would use are:

* **Reuse an existing category** when the discovered cluster is semantically close to it and the evidence snippets clearly match its meaning.
* **Create a new category** when the cluster is coherent but does not align well with any existing category.
* **Split a category** when papers inside that category form two or more stable subclusters with different descriptors.
* **Merge categories** when two categories have very similar centroids, very similar top terms, and largely interchangeable evidence.

I would **not** start with one-prompt-per-PDF keywording as the main method. That produces lots of synonyms and nice-looking but inconsistent labels. The cluster-first approach is better because it gives you **global consistency**, and the LLM is then used for **judgment and naming**, not for inventing 101 separate mini-taxonomies.

For a corpus of **101 articles**, I also would **not** start by fine-tuning a custom model. A strong embedding + clustering + LLM adjudication workflow is easier to audit and usually enough.

A single final report is absolutely feasible. The report should contain:

* the **final taxonomy**
* each article’s **assigned categories/keywords**
* every **new / split / merge / reused** category decision
* a short **rationale and evidence snippet** for each decision
* a list of **low-confidence cases** that need manual review

The cleanest starting package would be:

* your **SQLite export/schema**
* the table that links **articles ↔ existing keywords/categories**
* the **mapping questions**
* the PDFs only if full text is not already stored cleanly in the DB

If you want the most compact summary of the method: **scientific embeddings + zero-shot/semi-supervised topic modeling + LLM-based taxonomy adjudication + evidence-backed reporting**.

[1]: https://maartengr.github.io/BERTopic/getting_started/zeroshot/zeroshot.html "Zero-shot Topic Modeling - BERTopic"
[2]: https://grobid.readthedocs.io/en/latest/Principles/ "How GROBID works - GROBID Documentation"
[3]: https://maartengr.github.io/KeyBERT/ "KeyBERT"
[4]: https://maartengr.github.io/BERTopic/getting_started/hierarchicaltopics/hierarchicaltopics.html "Hierarchical Topic Modeling - BERTopic"
[5]: https://developers.openai.com/api/docs/guides/structured-outputs/ "Structured model outputs | OpenAI API"


Me: I also need to save the excerpts or reasons why article is keyworded as they were. Does that make it possible?


Yes — and it is not only possible, it is the **right way to do it**.

For your use case, every keyword assignment should be saved with **evidence** and a **reason**. That is practical because scholarly-PDF pipelines can preserve structure: PyMuPDF4LLM can extract PDF text to Markdown/JSON and supports building **page chunks**, while GROBID converts scholarly PDFs into structured **TEI XML** and can expose **PDF coordinates** for linking text back to the original pages. OpenAI Structured Outputs can then force the model to return a consistent JSON schema for each assignment. ([PyMuPDF][1])

The important design choice is to store **two layers**:

1. **Extractive evidence**
   Exact excerpt(s) from the article that support the keyword.
   Example fields:

   * article_id
   * keyword_id
   * excerpt_text
   * page_start / page_end
   * section_name
   * character offsets or PDF coordinates
   * evidence_score

2. **Abstractive rationale**
   A short normalized explanation such as:
   “Assigned `Model-driven testing` because the abstract and evaluation section describe automated test generation from system models.”
   This rationale should point to one or more saved excerpts instead of standing alone.

That gives you an auditable system: the model is not just “making up reasons,” it is attaching each decision to specific text spans. PyMuPDF4LLM and GROBID make that traceability realistic, and Structured Outputs makes the result easy to validate and store. ([PyMuPDF][1])

The best workflow is:

* extract structured text from each PDF
* split into chunks with page/section metadata
* generate candidate categories
* for each category, retrieve the **best supporting chunks**
* ask the model to output:

  * `reuse_existing / create_new / split / merge`
  * `assigned_keyword`
  * `confidence`
  * `evidence_excerpt_ids`
  * `short_reason`

For topic/category work, BERTopic can help produce interpretable topic terms and alternative topic representations, which is useful when deciding whether a cluster should reuse an existing category or become a new one. ([Maarten G.][2])

A simple SQLite shape could be:

```sql
articles(id, title, year, source_pdf)
categories(id, name, parent_id, status)
article_category_assignments(
    id, article_id, category_id, assignment_type,
    confidence, rationale_text, created_by, created_at
)
evidence_spans(
    id, article_id, page_no, section_name,
    excerpt_text, char_start, char_end, bbox_json
)
assignment_evidence(
    assignment_id, evidence_span_id, role, rank
)
category_change_log(
    id, old_category_id, new_category_id, change_type,
    note, created_at
)
```

That lets one article have:

* multiple categories
* multiple supporting excerpts per category
* a stored rationale
* a history of merges/splits/new categories

I would also separate:

* **topical keywords**: what the article is about
* **mapping-answer keywords**: why it matters for your mapping questions

That avoids mixing “topic of the paper” with “relevance to research question.”

A good final report can then show, for every article:

* assigned categories
* whether each was reused or newly created
* confidence
* 1–3 supporting excerpts with page numbers
* short reason
* notes on split/merge decisions where relevant

So yes: **you can absolutely save excerpts and reasons**, and doing so will make the AI keywording much more trustworthy and reviewable than plain keyword lists.

If you want, I can turn this into a concrete **end-to-end pipeline design** for your SQLite database and PDFs, including the exact JSON schema for the outputs.

[1]: https://pymupdf.readthedocs.io/en/latest/pymupdf4llm/?utm_source=chatgpt.com "PyMuPDF4LLM - PyMuPDF documentation - Read the Docs"
[2]: https://maartengr.github.io/BERTopic/index.html?utm_source=chatgpt.com "BERTopic"
