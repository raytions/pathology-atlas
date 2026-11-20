---
id: prostate
title: Prostate
tagline: Biopsy grading under the Gleason / ISUP system, with one large public benchmark.
featured: true
summary: >-
  Computational work on the prostate centres on needle biopsies and the Gleason grading
  system. The largest public benchmark is PANDA; most methods treat grading as weakly
  supervised slide-level classification.
review_status: verified
last_verified: 2026-11-20
sources:
  - key: panda-paper
    title: "Bulten et al. Artificial intelligence for diagnosis and Gleason grading of prostate cancer: the PANDA challenge. Nat Med (2022)"
    url: https://www.nature.com/articles/s41591-021-01620-2
    kind: paper
    accessed: 2026-11-20
---

Prostate cancer is graded on H&E-stained tissue by the architecture of its glands: pathologists
assign Gleason patterns and summarise them as an ISUP grade group. Agreement between
pathologists is imperfect, which is exactly why the task became a test bed for computational
pathology.

For researchers, the practical starting point is **biopsy-level grading**. Labels usually exist
per slide (a grade group, a Gleason score), while region masks are partial and noisy. That makes
the task a natural fit for weakly supervised, multiple-instance approaches, and a useful
downstream probe for pathology foundation models.

Things to check before you pick a dataset here: which institutions and scanners it covers, whether
the test labels are public or held back for a challenge, and whether masks were drawn per gland or
per region. The cards below show those fields; anything we have not confirmed is marked
*Not verified*.
