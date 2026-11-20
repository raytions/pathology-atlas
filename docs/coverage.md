# Coverage map

Status: **inventory, not verification.** Nothing in the candidate table below is published on the
site or has been checked to the standard in the README. It records what exists, what is missing,
where a candidate was discovered and what evidence is still needed before an entry can be drafted.

- Snapshot date: 2026-11-20 (status updated the same day after PRs #3 to #5)
- Repository state at snapshot: `main` at `e8c816c`
- Scan cap: 30 deduplicated candidates (this pass is deliberately bounded, not exhaustive)

## How to read this file

- **Discovery source** is where we first saw the candidate. Lists are discovery only; they are never
  the evidence for scale, access terms, annotation granularity or method relations.
- **Primary source** is the original release / paper / model card we found. "Listed, not opened" means
  the link comes from a list and has not been checked yet.
- **Action**: `reuse` (already covered), `extend` (add facts or relations to an existing entry),
  `add` (new entry), `verify` (needs primary-source work before drafting), `defer` (out of scope for now).
- Deduplication: papers by DOI / arXiv ID, datasets by original release identifier and version, models
  by official model card or project. Mirrors are not new datasets. Subsets or versions that need their
  own description (for example NCT-CRC-HE-100K vs CRC-VAL-HE-7K, both in one Zenodo record) stay separate.

Discovery-source codes:

| Code | List | Notes |
| --- | --- | --- |
| AP | [open-pathology/awesome-pathology](https://github.com/open-pathology/awesome-pathology) (CC0, pushed 2026-02-11) | Datasets, challenges, models, tools |
| OML | [openmedlab/Awesome-Medical-Dataset](https://github.com/openmedlab/Awesome-Medical-Dataset) (pushed 2026-10-02) | Per-dataset pages with aliases and entry links |
| AI4DP | [lingxitong/Awesome-AI4DigitalPathology](https://github.com/lingxitong/Awesome-AI4DigitalPathology) (Apache-2.0, pushed 2026-10-29) | Papers, foundation models, benchmarks |

## 1. Current coverage (from `src/content/`)

Public entries are `review_status: verified`. Pending entries stay in the repository and are filtered
out of every page.

| Organ | Disease | Task (scope) | Datasets | Methods with recorded relations |
| --- | --- | --- | --- | --- |
| prostate | prostate-adenocarcinoma | gleason-grading (specific) | panda; sicapv2 *(draft)* | uni → panda (evaluation) |
| breast | breast-cancer-nodal-metastasis | lymph-node-metastasis-detection (specific) | camelyon16, camelyon17 | clam, transmil, uni (evaluation) |
| breast | breast-cancer-nodal-metastasis | pn-staging (specific) | camelyon17 | none recorded |
| breast | breast-lesions | breast-lesion-subtyping (specific) | bracs | uni (evaluation) |
| any | any | wsi-classification, roi-classification, representation-learning (general families) | none (families) | abmil, clam, transmil, uni by task family |

Pending: `sicapv2` (draft), `conch` (needs-review).

Visible gaps: no colorectal, lung, kidney, skin or other organ; no nucleus / cell-level task; no
cross-organ datasets (TCGA, PanNuke, MoNuSeg); only one general-purpose foundation model (UNI) is
public.

### Structural gaps found during the scan (not fixed in this pass)

These limit what can be written accurately with the current schema. They are recorded here instead of
being forced into nearby fields.

1. **Resolved in #4: `patch-label` added to `ANNOTATION_GRANULARITY`.** Previously, tile datasets whose released unit is a
   fixed-size patch with one class label (NCT-CRC-HE-100K, CRC-VAL-HE-7K, MHIST, PCam) cannot be
   described accurately: `roi-label` means a label on a variable-size region of interest, and
   `region-mask` implies released masks.
2. **No segmentation / detection outputs in `OUTPUT_GRANULARITY`.** Nucleus and tissue segmentation
   methods (HoVer-Net, CellViT) and dense-prediction evaluations cannot be expressed.
3. **Vision-language models.** `OUTPUT_GRANULARITY` has `patch-embedding` but no text embedding or
   zero-shot output, so CONCH-style capabilities can only be described in prose.
4. **Benchmarks / evaluation frameworks** (kaiko-ai eva, Patho-Bench, THUNDER) are neither datasets
   nor methods. There is no resource type for an evaluation protocol that reuses other datasets.
5. **Verified entries cannot link to pending ones.** A relation from a verified method (e.g. UNI) to a
   new draft dataset fails validation, so such relations can only be added when the dataset is
   promoted. Candidate relations of this kind are listed in PR bodies, not in content.
6. **Conflicting source numbers** have no field. They go in `reviewer_notes` and PR text.

## 2. Candidates (deduplicated, capped at 30)

| # | Name | Type | Organ / task | Discovery | Primary source | Action | Evidence still missing |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | SICAPv2 (**published in #3**) | Dataset | Prostate / Gleason grading (biopsy) + Gleason pattern classification (patch) | OML, AI4DP | [Mendeley Data 10.17632/9xxm58dvs3](https://data.mendeley.com/datasets/9xxm58dvs3/2) (v1 2020-07-20, v2 2020-10-22, CC BY 4.0); paper [10.1016/j.cmpb.2020.105637](https://doi.org/10.1016/j.cmpb.2020.105637), preprint [arXiv 2105.10490](https://arxiv.org/abs/2105.10490) | extend (existing draft) | Slide count conflicts inside the paper (abstract 182 WSIs vs body 155 biopsies); per-class patch totals in the text differ from Table 3. Changes between Mendeley v1 and v2 undocumented. |
| 2 | CONCH (**published in #3**) | Model (vision-language) | Cross-organ / representation learning, ROI + slide classification | AP, AI4DP | [Nat Med 10.1038/s41591-024-02856-4](https://www.nature.com/articles/s41591-024-02856-4); [arXiv 2307.12914](https://arxiv.org/abs/2307.12914); [HF model card](https://huggingface.co/MahmoodLab/CONCH) | extend (existing needs-review) | Exact SICAP / CRC100k versions used are not named by release DOI; Nat Med table numbering vs arXiv numbering not cross-checked. |
| 3 | NCT-CRC-HE-100K (+ NONORM variant) | Dataset | Colorectal / tissue-type classification | AP, OML, AI4DP | [Zenodo 10.5281/zenodo.1214456](https://doi.org/10.5281/zenodo.1214456) (v0.1, 2018-04-07, CC BY 4.0) | add (vocabulary unblocked by #4) | Zenodo says 86 *slides*; OML page says 86 *patients* and lists DEB = 1,512 with 11.5 % share (inconsistent). Primary paper (Kather et al., PLoS Med 2019) not yet opened. |
| 4 | CRC-VAL-HE-7K | Dataset (separate release in the same Zenodo record) | Colorectal / tissue-type classification | Zenodo record, eva docs | Same Zenodo record; 7,180 patches from 50 patients per Zenodo | add separately (unblocked by #4) | CONCH describes "CRC100k" as tiles from 50 patients, mixing the two releases. eva uses 100K as train and 7K as validation: a project protocol, not an official split. |
| 5 | MHIST | Dataset | Colorectal polyps / HP vs SSA classification | AP, OML, AI4DP | [bmirds.github.io/MHIST](https://bmirds.github.io/MHIST/); [arXiv 2101.12355](https://arxiv.org/abs/2101.12355) | add (unblocked by #4) | Access requires a Dataset Research Use Agreement form; terms text not yet read. Official train/test split to be confirmed from the paper. |
| 6 | Lizard | Dataset | Colorectal / nucleus segmentation + classification | AI4DP | [ICCVW 2021 paper](https://openaccess.thecvf.com/content/ICCV2021W/CDPath/html/Graham_Lizard_A_Large-Scale_Dataset_for_Colonic_Nuclear_Instance_Segmentation_and_ICCVW_2021_paper.html) | verify | Download page, licence, region / nucleus counts. Needs a nucleus task; methods blocked by gap 2. |
| 7 | CoNIC 2022 | Challenge / dataset release derived from Lizard | Colorectal / nucleus segmentation, classification, counting | AP, OML, AI4DP | [conic-challenge.grand-challenge.org](https://conic-challenge.grand-challenge.org/) (fetch returned 403) | verify | Relationship to Lizard (patch release vs original regions, hidden test data), challenge paper. Keep separate from tissue and polyp classification. AI4DP's linked "MedIA 2022" paper not checked. |
| 8 | BACH (ICIAR 2018) | Dataset / challenge | Breast / 4-class microscopy classification (Part A) + WSI segmentation (Part B) | AP, OML (as two tasks), AI4DP | [MedIA paper S1361841518301789](https://www.sciencedirect.com/science/article/pii/S1361841518301789) (listed, not opened); [challenge site](https://iciar2018-challenge.grand-challenge.org/) | verify | Decide one entry with two parts vs two entries; licence; image counts. Part A fits `roi` + `roi-label` and existing `breast-lesion-subtyping`. |
| 9 | Gleason2019 | Challenge dataset | Prostate / pixel-level Gleason annotation on TMA cores | AP, OML | [gleason2019.grand-challenge.org](https://gleason2019.grand-challenge.org/) (listed) | verify | Paper, licence, number of cores and annotators. Fits `tma` + `pixel-mask`. OML's **PANDA** row wrongly points here (331 cases). |
| 10 | AGGC 2022 | Challenge dataset | Prostate / WSI Gleason pattern segmentation | OML, AI4DP | [aggc22.grand-challenge.org](https://aggc22.grand-challenge.org/) (listed) | verify | The UNI paper describes the AGGC publication as pending; licence and access unknown. |
| 11 | PatchCamelyon (PCam) | Derived dataset | Breast lymph node / patch metastasis classification | AP, OML, AI4DP | [github.com/basveeling/pcam](https://github.com/basveeling/pcam) (listed) | verify | OML lists it under CAMELYON16; if it is derived from that release, the relation to `camelyon16` must be explicit (a derived dataset, not a mirror). |
| 12 | BCNB | Dataset | Breast / core-needle biopsy WSIs | AP, AI4DP | [bcnb.grand-challenge.org](https://bcnb.grand-challenge.org/) / [project site](https://bupt-ai-cz.github.io/BCNB/) (listed) | verify | Paper, access terms, labels. |
| 13 | TIGER | Challenge dataset | Breast / TIL segmentation and scoring | AP, AI4DP | [tiger.grand-challenge.org](https://tiger.grand-challenge.org/) (listed) | verify | Needs a TIL task; segmentation side blocked by gap 2. |
| 14 | UniToPatho | Dataset | Colorectal polyps / polyp type + dysplasia grading | AP, AI4DP | [github.com/EIDOSLAB/UNITOPATHO](https://github.com/EIDOSLAB/UNITOPATHO/), [arXiv 2009.00650](https://arxiv.org/abs/2009.00650) (listed) | verify | Release (Zenodo) and licence; unit (crops) may hit gap 1. |
| 15 | PanNuke | Dataset | Cross-organ / nucleus segmentation + classification | AP, OML | [Warwick TIA PanNuke page](https://warwick.ac.uk/fac/cross_fac/tia/data/pannuke/) (listed) | verify | Paper(s), licence, counts. Methods blocked by gap 2. |
| 16 | MoNuSeg | Dataset / challenge | Cross-organ / nucleus segmentation | AP, AI4DP | [TMI 2020 (IEEE 8880654)](https://ieeexplore.ieee.org/document/8880654) (listed) | defer | Segmentation methods blocked by gap 2. |
| 17 | TCGA diagnostic WSIs | Cross-organ data source | Many organs / many tasks | AP, AI4DP | [GDC portal](https://portal.gdc.cancer.gov/) (listed) | verify | Decide granularity (per project, e.g. TCGA-BRCA / TCGA-PRAD / TCGA-COAD) and record open vs controlled access per data type. Several catalogued methods (CLAM, TransMIL) used TCGA cohorts. |
| 18 | UNI2-h (**published in #5**) | Model | Cross-organ / representation learning | AP, AI4DP | [HF MahmoodLab/UNI2-h](https://huggingface.co/MahmoodLab/UNI2-h) (listed; also named in the UNI repo) | verify | Model-vs-version policy: different architecture and data from UNI, so likely its own entry. Evaluation evidence beyond the repo table. |
| 19 | Virchow (**published in #5**) | Model | Cross-organ / representation learning | AP, AI4DP | [Nat Med 10.1038/s41591-024-03141-0](https://www.nature.com/articles/s41591-024-03141-0) (listed) | verify | Model card access terms; evaluated datasets. |
| 20 | Virchow2 (**published in #5**) | Model (separate from Virchow) | Cross-organ / representation learning | AI4DP | [arXiv 2408.00738](https://arxiv.org/abs/2408.00738) (listed) | verify | Same as above; keep separate from Virchow. |
| 21 | Prov-GigaPath | Model (tile + slide encoder) | Cross-organ / representation learning, slide encoding | AP, AI4DP | [Nature 10.1038/s41586-024-07441-w](https://www.nature.com/articles/s41586-024-07441-w) (listed) | verify | Weights terms; which tasks are reported on catalogued datasets. |
| 22 | Phikon / Phikon-v2 (**Phikon-v2 published in #5**; Phikon not yet) | Models (two entries) | Cross-organ / representation learning | AP, AI4DP | [arXiv 2309.16864](https://arxiv.org/abs/2309.16864), [arXiv 2409.09173](https://arxiv.org/abs/2409.09173) (listed) | verify | Licence per version; evaluations. |
| 23 | CTransPath (vs TransPath) | Model | Cross-organ / representation learning | AI4DP (CTransPath), AP (TransPath repo) | [MedIA S1361841522002043](https://www.sciencedirect.com/science/article/abs/pii/S1361841522002043) (listed) | verify | Alias check: AP links the TransPath repository; CTransPath and TransPath are different papers that share a repo. |
| 24 | H-optimus-0 | Model | Cross-organ / representation learning | AP, AI4DP | [HF bioptimus/H-optimus-0](https://huggingface.co/bioptimus/H-optimus-0) (listed) | verify | Paper or technical report; evaluations. |
| 25 | PLIP | Model (vision-language) | Cross-organ | AI4DP | [Nat Med 10.1038/s41591-023-02504-3](https://www.nature.com/articles/s41591-023-02504-3) (listed) | verify | Gap 3 for vision-language outputs. |
| 26 | HIPT | Model (hierarchical slide encoder) | Cross-organ / slide classification | AP, AI4DP | [arXiv 2206.02647](https://arxiv.org/abs/2206.02647) (listed) | verify | Evaluated datasets (TCGA, gap with #17). |
| 27 | TITAN | Model (slide foundation model) | Cross-organ | AP | [github.com/mahmoodlab/TITAN](https://github.com/mahmoodlab/TITAN/) (listed) | verify | Paper and weights terms. |
| 28 | HoVer-Net | Method | Cross-organ / nucleus segmentation + classification | AP | [MedIA 58, 101563 (2019)](https://doi.org/10.1016/j.media.2019.101563) (cited in CONCH refs; not opened) | defer, **blocked by gap 2** | Output type not expressible. |
| 29 | Kather et al. 2019 CRC CNN | Method / paper | Colorectal / tissue classification, survival | Zenodo record, CONCH refs | PLoS Med 16, e1002730 (2019) (cited, not opened) | verify | Paper that released NCT-CRC-HE-100K; would carry the training / evaluation relations for #3 and #4. |
| 30 | kaiko-ai eva (CRC protocol) | Evaluation framework | Cross-organ benchmark protocols | AP, AI4DP | [eva CRC docs](https://kaiko-ai.github.io/eva/main/datasets/crc/) | defer, **gap 4** | A project protocol (100K train / 7K val), not an official split, and not evidence that any model reported a result. |

### Discovery-source issues noticed (do not copy into content)

- OML NCT-CRC-HE-100K page: "86 patients" (Zenodo: 86 slides); DEB count 1,512 printed with an 11.5 %
  share; release date shown as 2008-04 (Zenodo: 2018-04-07).
- OML PANDA row: description and link belong to Gleason2019 (331 cases).
- AI4DP labels the BRACS paper "Sci Data 2022"; the version we verified is the arXiv preprint, and the
  journal record has not been opened. AI4DP labels SICAPv2's paper "JBHI 2020"; the Mendeley record
  names the CMPB 2020 paper, while CONCH cites the JBHI 2021 paper for SICAP.
- CONCH describes CRC100k as tiles "from 50 patients"; per Zenodo that number belongs to CRC-VAL-HE-7K.

## 3. Recommended next batches

| Batch | Scope | Value for researchers | Evidence status | Depends on |
| --- | --- | --- | --- | --- |
| A. Prostate Gleason, ROI level (**published in #3**) | Complete `sicapv2`, add task `gleason-pattern-classification`, complete `conch` with its SICAP evaluation | Gives the existing prostate topic a patch-level Gleason route: prostate → Gleason pattern classification → SICAPv2 → CONCH (evaluation, located in tables) | Sufficient for draft entries: Mendeley record, CMPB preprint, CONCH paper tables, CONCH model card. Two numeric conflicts are kept out of scale fields. | None |
| B. Colorectal tissue + polyp classification | NCT-CRC-HE-100K, CRC-VAL-HE-7K (separate), MHIST, Kather 2019; CONCH and UNI relations to them | Most-used colorectal benchmarks; enables a colorectal topic | Zenodo and MHIST pages checked; Kather 2019 and MHIST paper not yet opened | Vocabulary done in #4; still needs organ / disease entries for colorectum |
| C. Cross-organ foundation models (**first four published in #5**; Prov-GigaPath, H-optimus-0, Phikon still open) | UNI2-h, Virchow, Virchow2, Prov-GigaPath, Phikon(-v2), H-optimus-0, each with relations only to catalogued datasets | Lets researchers compare encoders by access terms and by where they were actually evaluated | Model cards listed, papers not opened; relations need table-level checks | Benefits from B (more catalogued datasets to relate to); gap 5 means relations to draft datasets wait for promotion |

Further out: a nucleus-level batch (Lizard / CoNIC, PanNuke, HoVer-Net) needs gap 2 resolved first.
