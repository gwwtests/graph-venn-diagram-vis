# Example DAG: Coverage of All Membership Cases

## Goal

Define a single master example graph that covers every meaningful combination of shared/disjoint membership between entities, categories, and domains.

## Cases to Cover

### Entity ↔ Category relationships

| Case ID | Description | Example |
|---------|-------------|---------|
| EC-1 | Entity belongs to exactly one category | x1 → {c1} |
| EC-2 | Entity belongs to multiple categories | x3 → {c1, c2} |
| EC-3 | Two entities share a category | x1, x3 both → c1 |
| EC-4 | Two entities share NO categories | x1 (only c1) vs x5 (only c4) |
| EC-5 | Entity belongs to categories from different domains | x3 → {c1 (under d1), c2 (under d2)} |
| EC-6 | Entity belongs to categories within the same domain | x2 → {c1, c3} both under d1 |

### Category ↔ Domain relationships

| Case ID | Description | Example |
|---------|-------------|---------|
| CD-1 | Category belongs to exactly one domain | c4 → {d3} |
| CD-2 | Category belongs to multiple domains | c2 → {d1, d2} |
| CD-3 | Two categories share a domain | c1, c3 both → d1 |
| CD-4 | Two categories share NO domains | c1 (only d1) vs c4 (only d3) |

### Cross-layer relationships (Entity ↔ Domain, indirect)

| Case ID | Description | Example |
|---------|-------------|---------|
| XD-1 | Two entities share a domain but NOT a category | x1 (c1→d1) vs x2 (c3→d1): share d1, no shared category |
| XD-2 | Two entities share both a category and a domain | x1, x3 both in c1→d1 |
| XD-3 | Two entities share NO domain at all | x1 (d1 only) vs x5 (d3 only) |
| XD-4 | Entity reachable from multiple domains | x3 → c1→d1, c2→d2: reachable from d1 and d2 |

### Isolation cases

| Case ID | Description | Example |
|---------|-------------|---------|
| ISO-1 | An isolated entity (single category, single domain path) | x5 → c4 → d3 |
| ISO-2 | A category with only one entity | c4 → {x5} |
| ISO-3 | A domain with only one category | d3 → {c4} |

## Master Example Graph

### Domains (top layer)

* **d1** — "Engineering"
* **d2** — "Science"
* **d3** — "Arts"

### Categories (middle layer)

* **c1** — "Software" → belongs to {d1}
* **c2** — "Data" → belongs to {d1, d2} ← shared across domains (CD-2)
* **c3** — "Hardware" → belongs to {d1} ← same domain as c1 (CD-3)
* **c4** — "Design" → belongs to {d3} ← single domain (CD-1)
* **c5** — "Research" → belongs to {d2} ← single domain

### Entities (bottom layer)

* **x1** → {c1} — single category (EC-1), shares c1 with x3 (EC-3)
* **x2** → {c1, c3} — multiple categories same domain (EC-6)
* **x3** → {c1, c2} — multiple categories across domains (EC-2, EC-5), shares c1 with x1 (EC-3)
* **x4** → {c2, c5} — multiple categories in d2 domain
* **x5** → {c4} — isolated path (ISO-1, ISO-2)
* **x6** → {c3, c4} — spans d1 and d3 via categories

### Adjacency (edges)

```
Domain → Category edges:
  d1 → c1, d1 → c2, d1 → c3
  d2 → c2, d2 → c5
  d3 → c4

Category → Entity edges:
  c1 → x1, c1 → x2, c1 → x3
  c2 → x3, c2 → x4
  c3 → x2, c3 → x6
  c4 → x5, c4 → x6
  c5 → x4
```

### Verification of Cases

```
EC-1: x1 → {c1} only                               ✓
EC-2: x3 → {c1, c2}                                 ✓
EC-3: x1 and x3 both in c1                          ✓
EC-4: x1 (c1) vs x5 (c4) — no shared category       ✓
EC-5: x3 → c1 (d1) and c2 (d1,d2)                   ✓
EC-6: x2 → c1 (d1) and c3 (d1)                      ✓

CD-1: c4 → {d3} only                                ✓
CD-2: c2 → {d1, d2}                                 ✓
CD-3: c1 and c3 both in d1                           ✓
CD-4: c1 (d1) vs c4 (d3) — no shared domain          ✓

XD-1: x1 (c1→d1) vs x2 (c1,c3→d1) — share d1 and c1
       Better: x2 (c1,c3→d1) vs x4 (c2→d1,d2; c5→d2)
       x2 and x4 share d1 (via c2 for x4) but NOT a category ✓
XD-2: x1 and x3 share c1 and d1                     ✓
XD-3: x1 (d1) vs x5 (d3) — no shared domain         ✓
XD-4: x3 reachable from d1 (via c1) and d2 (via c2) ✓

ISO-1: x5 → c4 → d3 (single path)                   ✓
ISO-2: c4 has x5 and x6                             (x6 added, so c5 is ISO-2: c5 → {x4} only) ✓
ISO-3: d3 → {c4} only                               ✓
```

### Visual DAG Sketch

```
Layer 0 (Domains):    [d1]          [d2]         [d3]
                     / | \         / |             |
Layer 1 (Cats):    [c1][c2][c3]  [c2][c5]        [c4]
                   /|   |   \      |  |           / \
Layer 2 (Ents): [x1][x2][x3] [x4]              [x5][x6]

  x1 ← c1
  x2 ← c1, c3
  x3 ← c1, c2
  x4 ← c2, c5
  x5 ← c4
  x6 ← c3, c4
```

## Path Count Examples

When all domains selected (all active):

* x1: 1 path (d1→c1→x1)
* x2: 2 paths (d1→c1→x2, d1→c3→x2)
* x3: 3 paths (d1→c1→x3, d1→c2→x3, d2→c2→x3)
* x4: 3 paths (d1→c2→x4, d2→c2→x4, d2→c5→x4)
* x5: 1 path (d3→c4→x5)
* x6: 2 paths (d1→c3→x6, d3→c4→x6)

When only d1 selected:

* x1: 1 path (d1→c1→x1)
* x2: 2 paths (d1→c1→x2, d1→c3→x2)
* x3: 2 paths (d1→c1→x3, d1→c2→x3)
* x4: 1 path (d1→c2→x4)
* x5: 0 paths (inactive)
* x6: 1 path (d1→c3→x6)
