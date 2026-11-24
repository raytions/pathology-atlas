---
id: colorectum
title: Colorectum
tagline: Patch-level tissue classification on H&E, with a training set and an independent test set released together.
featured: false
summary: >-
  Colorectal pathology enters the atlas through tissue-type classification of small H&E patches.
  NCT-CRC-HE-100K and CRC-VAL-HE-7K were released together as a training set and a test set from
  different patients, and many pathology encoders report results on that pair.
review_status: verified
last_verified: 2026-11-20
sources:
  - key: zenodo-crc
    title: "Kather J. N., Halama N., Marx A. 100,000 histological images of human colorectal cancer and healthy tissue. Zenodo, v0.1 (2018)"
    url: https://doi.org/10.5281/zenodo.1214456
    kind: data-portal
    accessed: 2026-11-20
  - key: kather-paper
    title: "Kather J. N. et al. Predicting survival from colorectal cancer histology slides using deep learning: a retrospective multicenter study. PLoS Med 16, e1002730 (2019)"
    url: https://pmc.ncbi.nlm.nih.gov/articles/PMC6345440/
    kind: paper
    accessed: 2026-11-20
---

Colorectal cancer tissue is a mosaic: tumour epithelium sits next to stroma, mucus, muscle,
lymphocytes, fat, debris and normal mucosa. Telling these apart on small patches is the first step
in many pipelines, for example to measure how much of a tumour is stroma before relating that to
outcome.

The two datasets below are tile collections, not slide collections. Each released image is a
224 x 224 patch with one tissue label, cut from regions that a blinded observer outlined by hand. Treat
the larger set as training data and the smaller one as the external test set: they come from
different patients, and the release itself suggests that use.

Before comparing numbers across papers, check two things the cards below record: whether a model
used the colour-normalised or the unnormalised training images, and whether it reports balanced
accuracy, since the classes are only roughly balanced.
