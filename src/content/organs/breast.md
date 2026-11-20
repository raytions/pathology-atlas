---
id: breast
title: Breast
tagline: Lymph-node metastasis detection and lesion subtyping, from CAMELYON to BRACS.
featured: false
summary: >-
  Breast is covered here through two task lines: detecting metastases in sentinel lymph nodes
  (CAMELYON16 and CAMELYON17) and subtyping breast lesions across benign, atypical and
  malignant categories (BRACS).
review_status: verified
last_verified: 2026-11-20
sources:
  - key: camelyon-gigascience
    title: "Litjens et al. 1399 H&E-stained sentinel lymph node sections of breast cancer patients: the CAMELYON dataset. GigaScience (2018)"
    url: https://pmc.ncbi.nlm.nih.gov/articles/PMC6007545/
    kind: paper
    accessed: 2026-11-20
  - key: bracs-preprint
    title: "Brancati et al. BRACS: A Dataset for BReAst Carcinoma Subtyping in H&E Histology Images (arXiv 2111.04740)"
    url: https://arxiv.org/abs/2111.04740
    kind: preprint
    accessed: 2026-11-20
---

Two very different problems share this page. **Sentinel lymph node assessment** asks whether a
breast cancer has spread to the node, and how large the largest metastasis is. It is a search
problem: small tumour deposits hidden in a gigapixel slide. The CAMELYON challenges turned it into
the field's first widely used WSI benchmark.

**Lesion subtyping** works on the breast tissue itself. Benign, atypical and malignant lesions
sit on a spectrum, and the atypical categories are rare and hard to call. BRACS provides slide
and region-level labels across that spectrum, with patient-level splits.

Note that many "breast" methods were only evaluated on the lymph-node task. The relation labels
below tell you which is which.
