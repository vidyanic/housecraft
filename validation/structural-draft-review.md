# Draft layout improvement and manual review

13 October 2026. Source: Downloads/layout.json. The original is preserved. Import `structural-draft-improved.json` to inspect the revised draft.

116 changed members; recorded failures 51 → 39. These counts are software screening outcomes, not design approval.

## Floor stack

| Floor | Elevation (cm) | Storey (cm) | Columns | Beams |
|---|---:|---:|---:|---:|
| Ground floor | 0 | 304.8 | 19 | 40 |
| First floor | 304.8 | 304.8 | 19 | 40 |
| Floor 2 | 609.6 | 300 | 0 | 0 |

## Review conclusions

- Both framed floors have 19 columns and 40 beams. Floor 2 has no columns/beams; confirm whether it is an occupied level, roof or stair arrival and model its actual structural support.
- Small bay/stack movements are bounded to 5 cm. Heights follow existing elevations; beam display levels now follow the same heights. Check architectural clearances and deliberately skewed bays.
- Nearby unambiguous joints can reconnect. Fifty joint-end warnings remain. The frame model reports 34 members without supported end conditions; do not treat a beam-to-beam intersection as a column connection.
- Footing checks use edges relative to the located site rectangle. The target is 1 foot, editable to 2 feet or another surveyed/design value. Boundary footing, eccentricity, strap/combined footing and bearing calculations need engineering review.
- Ground-floor sizing was withheld where it would introduce failed checks. Column enlargement must preserve adequate reinforcement; reinforcement is not redesigned automatically.
- Beam sizing uses a full-panel/wall UDL section envelope and span/depth checks. It does not validate the saved reinforcing bars, shear capacity, concentrated/transfer loads or seismic detailing.

## Beam depth changes

| Floor / beam | Before width × depth (cm) | After width × depth (cm) |
|---|---|---|
| First floor / PB2 | 23 × 35 | 23 × 50 |
| First floor / PB4 | 23 × 35 | 23 × 50 |
| First floor / PB21 | 23 × 35 | 23 × 45 |
| First floor / SB3 | 23 × 25 | 23 × 30 |
| First floor / B37 | 23 × 30 | 23 × 40 |

## Proposal notes

- PB1: startColumnId needs manual review (0 nearby columns).
- PB1: endColumnId needs manual review (0 nearby columns).
- PB3: startColumnId needs manual review (0 nearby columns).
- PB3: endColumnId needs manual review (0 nearby columns).
- PB7: startColumnId needs manual review (0 nearby columns).
- PB7: endColumnId needs manual review (0 nearby columns).
- PB18: startColumnId needs manual review (0 nearby columns).
- PB18: endColumnId needs manual review (0 nearby columns).
- PB24: startColumnId needs manual review (0 nearby columns).
- PB24: endColumnId needs manual review (0 nearby columns).
- SB3: startColumnId needs manual review (0 nearby columns).
- B27: startColumnId needs manual review (0 nearby columns).
- B27: endColumnId needs manual review (0 nearby columns).
- B36: startColumnId needs manual review (0 nearby columns).
- B36: endColumnId needs manual review (0 nearby columns).
- B37: startColumnId needs manual review (0 nearby columns).
- B37: endColumnId needs manual review (0 nearby columns).
- B34: startColumnId needs manual review (0 nearby columns).
- B35: startColumnId needs manual review (0 nearby columns).
- B35: endColumnId needs manual review (0 nearby columns).
- B36: endColumnId needs manual review (0 nearby columns).
- B37: endColumnId needs manual review (0 nearby columns).
- B38: endColumnId needs manual review (0 nearby columns).
- B39: endColumnId needs manual review (0 nearby columns).
- B40: endColumnId needs manual review (0 nearby columns).
- PB1: startColumnId needs manual review (0 nearby columns).
- PB1: endColumnId needs manual review (0 nearby columns).
- PB3: startColumnId needs manual review (0 nearby columns).
- PB3: endColumnId needs manual review (0 nearby columns).
- PB7: startColumnId needs manual review (0 nearby columns).
- PB7: endColumnId needs manual review (0 nearby columns).
- PB18: startColumnId needs manual review (0 nearby columns).
- PB18: endColumnId needs manual review (0 nearby columns).
- PB24: startColumnId needs manual review (0 nearby columns).
- PB24: endColumnId needs manual review (0 nearby columns).
- SB3: startColumnId needs manual review (0 nearby columns).
- B27: startColumnId needs manual review (0 nearby columns).
- B27: endColumnId needs manual review (0 nearby columns).
- B36: startColumnId needs manual review (0 nearby columns).
- B36: endColumnId needs manual review (0 nearby columns).
- B37: startColumnId needs manual review (0 nearby columns).
- B37: endColumnId needs manual review (0 nearby columns).
- B34: startColumnId needs manual review (0 nearby columns).
- B35: startColumnId needs manual review (0 nearby columns).
- B35: endColumnId needs manual review (0 nearby columns).
- B36: endColumnId needs manual review (0 nearby columns).
- B37: endColumnId needs manual review (0 nearby columns).
- B38: endColumnId needs manual review (0 nearby columns).
- B39: endColumnId needs manual review (0 nearby columns).
- B40: endColumnId needs manual review (0 nearby columns).
- All floors: column/beam heights follow the next existing elevation; top storey uses the basis height. Shared coordinate constraints square nearly axial bays and preserve stacks within 5 cm total travel. Unique nearby joints repair; ambiguous joints and boundary footings remain for manual review. Confirm architectural clearances and deliberate skew before applying.
- Ground floor: no eligible section increases.
- Ground floor: Sections only increase; reinforcement, IDs, centres, support types and locks are preserved. Beam depth includes full-panel/wall load envelope and self-weight iteration. Review reinforcement and shear before construction.
- First floor: Sections only increase; reinforcement, IDs, centres, support types and locks are preserved. Beam depth includes full-panel/wall load envelope and self-weight iteration. Review reinforcement and shear before construction.
- Floor 2: no eligible section increases.
- Floor 2: Sections only increase; reinforcement, IDs, centres, support types and locks are preserved. Beam depth includes full-panel/wall load envelope and self-weight iteration. Review reinforcement and shear before construction.
- Building sizing includes cumulative loads from every modelled floor. No future floors are assumed.

## Every failed computed check

- Ground floor / `3291d796-9405-43bc-b5a7-a6864e5de3a8`: Service bearing pressure (footing self-weight excluded); demand 158.72351466200752, capacity 150.
- Ground floor / `6ec83171-ee5e-425d-93da-c6f0e9e2422f`: Service bearing pressure (footing self-weight excluded); demand 154.4605989429398, capacity 150.

## Every issue for review

- **FAIL** — Ground floor / `3291d796-9405-43bc-b5a7-a6864e5de3a8`: C2: footing edge clearance -10.4 cm; target 30.48 cm. Review boundary survey, eccentric/combined/strap footing; do not shift the building automatically.
- **FAIL** — Ground floor / `aaf4996d-4bda-40e5-b021-b649663ae295`: C4: footing edge clearance -10.4 cm; target 30.48 cm. Review boundary survey, eccentric/combined/strap footing; do not shift the building automatically.
- **FAIL** — Ground floor / `7d5f0109-ebb8-429d-b158-3583a511afc5`: C6: footing edge clearance -10.4 cm; target 30.48 cm. Review boundary survey, eccentric/combined/strap footing; do not shift the building automatically.
- **FAIL** — Ground floor / `4911466c-bfbd-4744-8f87-7d441f692379`: Beam needs explicit column end connections, or one restrained end for a cantilever.
- **FAIL** — Ground floor / `acac6976-4e36-4939-a868-78e4d5111444`: Beam needs explicit column end connections, or one restrained end for a cantilever.
- **FAIL** — Ground floor / `f3cdac54-b950-4b65-9c07-7f7d0dc6c001`: Beam needs explicit column end connections, or one restrained end for a cantilever.
- **FAIL** — Ground floor / `fc42ba45-3940-4024-ac24-6e50ba4784ae`: Beam needs explicit column end connections, or one restrained end for a cantilever.
- **FAIL** — Ground floor / `5e84df55-4457-4c79-94bf-73fc8342b288`: Beam needs explicit column end connections, or one restrained end for a cantilever.
- **FAIL** — Ground floor / `2f37ea3d-41e8-4a21-8cda-07ce3108444a`: Beam needs explicit column end connections, or one restrained end for a cantilever.
- **FAIL** — Ground floor / `875af433-f352-401e-8502-c7d9cff36c43`: Beam needs explicit column end connections, or one restrained end for a cantilever.
- **FAIL** — Ground floor / `f8d7ae2b-39fe-4611-ae19-d8b014a2fb68`: Beam needs explicit column end connections, or one restrained end for a cantilever.
- **FAIL** — Ground floor / `33e1efda-ccae-4029-abbb-1f1b40be1e16`: Beam needs explicit column end connections, or one restrained end for a cantilever.
- **FAIL** — Ground floor / `03a85cc9-efc2-4110-b082-7b1634ec1e17`: Beam needs explicit column end connections, or one restrained end for a cantilever.
- **FAIL** — Ground floor / `2d7dc950-ce79-4f60-ac29-7e38f84f3b5c`: Beam needs explicit column end connections, or one restrained end for a cantilever.
- **FAIL** — Ground floor / `19e375e3-ef0f-4e2f-a371-de257618b3e4`: Beam needs explicit column end connections, or one restrained end for a cantilever.
- **FAIL** — Ground floor / `345f101d-0009-477f-bf0e-be81c9b46621`: Beam needs explicit column end connections, or one restrained end for a cantilever.
- **FAIL** — Ground floor / `9e9cacbc-0182-40a8-9e14-85dda7909471`: Beam needs explicit column end connections, or one restrained end for a cantilever.
- **FAIL** — Ground floor / `5e8e7212-4139-4ba2-a144-ee79fe2ec46c`: Beam needs explicit column end connections, or one restrained end for a cantilever.
- **FAIL** — Ground floor / `6753e9bc-52ec-48a3-ab6c-b83065b620ce`: Beam needs explicit column end connections, or one restrained end for a cantilever.
- **FAIL** — Ground floor / `50ecb73c-2589-49e6-94f7-b5d50a5084b5`: Beam needs explicit column end connections, or one restrained end for a cantilever.
- **FAIL** — First floor / `5wenqia`: Beam needs explicit column end connections, or one restrained end for a cantilever.
- **FAIL** — First floor / `0q50hh8`: Beam needs explicit column end connections, or one restrained end for a cantilever.
- **FAIL** — First floor / `ojdvfjh`: Beam needs explicit column end connections, or one restrained end for a cantilever.
- **FAIL** — First floor / `rfddi5q`: Beam needs explicit column end connections, or one restrained end for a cantilever.
- **FAIL** — First floor / `20afch8`: Beam needs explicit column end connections, or one restrained end for a cantilever.
- **FAIL** — First floor / `iy5so0m`: Beam needs explicit column end connections, or one restrained end for a cantilever.
- **FAIL** — First floor / `5197d342-c4c7-434b-ad11-c5728ce42960`: Beam needs explicit column end connections, or one restrained end for a cantilever.
- **FAIL** — First floor / `cfadedaa-212f-4434-ad1c-c2a690e0a826`: Beam needs explicit column end connections, or one restrained end for a cantilever.
- **FAIL** — First floor / `011083ec-767c-4c0c-8ee9-2cc33d4b52cb`: Beam needs explicit column end connections, or one restrained end for a cantilever.
- **FAIL** — First floor / `899256dc-ff76-4db7-bdc7-63733032ebb5`: Beam needs explicit column end connections, or one restrained end for a cantilever.
- **FAIL** — First floor / `16906145-eaf6-46df-b911-9b8a1d39acd4`: Beam needs explicit column end connections, or one restrained end for a cantilever.
- **FAIL** — First floor / `dcf8b331-48a2-4884-a8ea-523ef31bdcf6`: Beam needs explicit column end connections, or one restrained end for a cantilever.
- **FAIL** — First floor / `440a49eb-59aa-45e3-9564-6d44d2520697`: Beam needs explicit column end connections, or one restrained end for a cantilever.
- **FAIL** — First floor / `49dceb44-2706-4c7c-b428-ef1552b4f36a`: Beam needs explicit column end connections, or one restrained end for a cantilever.
- **FAIL** — First floor / `715b87cc-a6ed-4fd3-b2a3-69eaa84deee7`: Beam needs explicit column end connections, or one restrained end for a cantilever.
- **FAIL** — First floor / `38da54fd-cf3b-41cf-9faf-4e131fd157f1`: Beam needs explicit column end connections, or one restrained end for a cantilever.
- **FAIL** — First floor / `c36c8c29-be1d-4d2a-9e45-37de8dfd8b4c`: Beam needs explicit column end connections, or one restrained end for a cantilever.
- **REVIEW** — Ground floor / `cec75800-98cb-4491-a5ec-7aadef9e52f9`: C1: height/minimum section exceeds 12; effective length and biaxial/slender design required.
- **REVIEW** — Ground floor / `cec75800-98cb-4491-a5ec-7aadef9e52f9`: C1: footing edge clearance 16.9 cm; target 30.48 cm. Review boundary survey, eccentric/combined/strap footing; do not shift the building automatically.
- **REVIEW** — Ground floor / `3291d796-9405-43bc-b5a7-a6864e5de3a8`: C2: height/minimum section exceeds 12; effective length and biaxial/slender design required.
- **REVIEW** — Ground floor / `f1527870-35b7-41f7-b935-c6b8e39ab3ee`: C3: height/minimum section exceeds 12; effective length and biaxial/slender design required.
- **REVIEW** — Ground floor / `f1527870-35b7-41f7-b935-c6b8e39ab3ee`: C3: footing edge clearance 16.9 cm; target 30.48 cm. Review boundary survey, eccentric/combined/strap footing; do not shift the building automatically.
- **REVIEW** — Ground floor / `aaf4996d-4bda-40e5-b021-b649663ae295`: C4: height/minimum section exceeds 12; effective length and biaxial/slender design required.
- **REVIEW** — Ground floor / `7d5f0109-ebb8-429d-b158-3583a511afc5`: C6: height/minimum section exceeds 12; effective length and biaxial/slender design required.
- **REVIEW** — Ground floor / `2a591afe-1b23-4309-89de-42cc42ecd9b7`: C7: height/minimum section exceeds 12; effective length and biaxial/slender design required.
- **REVIEW** — Ground floor / `2a591afe-1b23-4309-89de-42cc42ecd9b7`: C7: footing edge clearance 28.3 cm; target 30.48 cm. Review boundary survey, eccentric/combined/strap footing; do not shift the building automatically.
- **REVIEW** — Ground floor / `2d5e8d87-49a7-467b-8d6e-697670bc1a7a`: C8: height/minimum section exceeds 12; effective length and biaxial/slender design required.
- **REVIEW** — Ground floor / `6ec83171-ee5e-425d-93da-c6f0e9e2422f`: C10: height/minimum section exceeds 12; effective length and biaxial/slender design required.
- **REVIEW** — Ground floor / `b2bd675d-d466-40e0-b949-1448d3e30212`: C11: height/minimum section exceeds 12; effective length and biaxial/slender design required.
- **REVIEW** — Ground floor / `b2bd675d-d466-40e0-b949-1448d3e30212`: C11: footing edge clearance 16.9 cm; target 30.48 cm. Review boundary survey, eccentric/combined/strap footing; do not shift the building automatically.
- **REVIEW** — Ground floor / `431e110c-be1e-49e0-a3d9-f409df889562`: C14: height/minimum section exceeds 12; effective length and biaxial/slender design required.
- **REVIEW** — Ground floor / `eb24d6bf-9e05-4834-b57a-62e5712e176d`: C15: height/minimum section exceeds 12; effective length and biaxial/slender design required.
- **REVIEW** — Ground floor / `fdc10e84-b019-4b7f-80f4-f25af199aaa2`: C16: height/minimum section exceeds 12; effective length and biaxial/slender design required.
- **REVIEW** — Ground floor / `93f3dcb0-241a-4978-a548-069be08a8b76`: C17: height/minimum section exceeds 12; effective length and biaxial/slender design required.
- **REVIEW** — Ground floor / `93f3dcb0-241a-4978-a548-069be08a8b76`: C17: footing edge clearance 28.3 cm; target 30.48 cm. Review boundary survey, eccentric/combined/strap footing; do not shift the building automatically.
- **REVIEW** — Ground floor / `35e21b43-b6ba-46ff-a157-5b9bc048460c`: C18: height/minimum section exceeds 12; effective length and biaxial/slender design required.
- **REVIEW** — Ground floor / `35e21b43-b6ba-46ff-a157-5b9bc048460c`: C18: footing edge clearance 28.3 cm; target 30.48 cm. Review boundary survey, eccentric/combined/strap footing; do not shift the building automatically.
- **REVIEW** — Ground floor / `ce204269-30f4-464f-ba1d-ed8c880845f1`: C19: height/minimum section exceeds 12; effective length and biaxial/slender design required.
- **REVIEW** — Ground floor / `ce204269-30f4-464f-ba1d-ed8c880845f1`: C19: footing edge clearance 16.9 cm; target 30.48 cm. Review boundary survey, eccentric/combined/strap footing; do not shift the building automatically.
- **REVIEW** — Ground floor / `13166716-7a6f-4cf8-bf64-54a4d88b1742`: C19: footing edge clearance 16.9 cm; target 30.48 cm. Review boundary survey, eccentric/combined/strap footing; do not shift the building automatically.
- **REVIEW** — Ground floor / `0554ade5-5563-42c4-9add-d0c5d2a0424a`: C19: footing edge clearance 28.3 cm; target 30.48 cm. Review boundary survey, eccentric/combined/strap footing; do not shift the building automatically.
- **REVIEW** — Ground floor / `4911466c-bfbd-4744-8f87-7d441f692379`: PB1: startColumnId is unconnected; confirm joint/support type.
- **REVIEW** — Ground floor / `4911466c-bfbd-4744-8f87-7d441f692379`: PB1: endColumnId is unconnected; confirm joint/support type.
- **REVIEW** — Ground floor / `4911466c-bfbd-4744-8f87-7d441f692379`: PB1: verify primary/secondary role and support condition, tributary loads, transfer/point loads, flexure, shear, anchorage and reinforcement. Automatic sizing is a section envelope only.
- **REVIEW** — Ground floor / `537c33d7-c9ac-43b2-939c-6157030c4e55`: PB2: verify primary/secondary role and support condition, tributary loads, transfer/point loads, flexure, shear, anchorage and reinforcement. Automatic sizing is a section envelope only.
- **REVIEW** — Ground floor / `acac6976-4e36-4939-a868-78e4d5111444`: PB3: startColumnId is unconnected; confirm joint/support type.
- **REVIEW** — Ground floor / `acac6976-4e36-4939-a868-78e4d5111444`: PB3: endColumnId is unconnected; confirm joint/support type.
- **REVIEW** — Ground floor / `acac6976-4e36-4939-a868-78e4d5111444`: PB3: verify primary/secondary role and support condition, tributary loads, transfer/point loads, flexure, shear, anchorage and reinforcement. Automatic sizing is a section envelope only.
- **REVIEW** — Ground floor / `793d1dbe-ad9c-4121-b005-977aae82a0a3`: PB4: verify primary/secondary role and support condition, tributary loads, transfer/point loads, flexure, shear, anchorage and reinforcement. Automatic sizing is a section envelope only.
- **REVIEW** — Ground floor / `8d4b06a0-9ae3-4f24-8710-aaf93935ae9c`: PB5: verify primary/secondary role and support condition, tributary loads, transfer/point loads, flexure, shear, anchorage and reinforcement. Automatic sizing is a section envelope only.
- **REVIEW** — Ground floor / `f3cdac54-b950-4b65-9c07-7f7d0dc6c001`: PB7: startColumnId is unconnected; confirm joint/support type.
- **REVIEW** — Ground floor / `f3cdac54-b950-4b65-9c07-7f7d0dc6c001`: PB7: endColumnId is unconnected; confirm joint/support type.
- **REVIEW** — Ground floor / `f3cdac54-b950-4b65-9c07-7f7d0dc6c001`: PB7: verify primary/secondary role and support condition, tributary loads, transfer/point loads, flexure, shear, anchorage and reinforcement. Automatic sizing is a section envelope only.
- **REVIEW** — Ground floor / `3626be50-b1ff-490c-8f63-3d772e6fb6eb`: PB8: verify primary/secondary role and support condition, tributary loads, transfer/point loads, flexure, shear, anchorage and reinforcement. Automatic sizing is a section envelope only.
- **REVIEW** — Ground floor / `a94c8684-155b-429c-8720-33d6d36ac5ab`: PB9: verify primary/secondary role and support condition, tributary loads, transfer/point loads, flexure, shear, anchorage and reinforcement. Automatic sizing is a section envelope only.
- **REVIEW** — Ground floor / `c42f52c7-b8fc-41c7-bf01-78adf42906b4`: PB11: verify primary/secondary role and support condition, tributary loads, transfer/point loads, flexure, shear, anchorage and reinforcement. Automatic sizing is a section envelope only.
- **REVIEW** — Ground floor / `8ecaa929-d41f-48db-a6c1-c8e4086b488c`: PB12: verify primary/secondary role and support condition, tributary loads, transfer/point loads, flexure, shear, anchorage and reinforcement. Automatic sizing is a section envelope only.
- **REVIEW** — Ground floor / `ee5d6515-84f6-4bd5-8766-64629edd22b2`: PB13: verify primary/secondary role and support condition, tributary loads, transfer/point loads, flexure, shear, anchorage and reinforcement. Automatic sizing is a section envelope only.
- **REVIEW** — Ground floor / `1ad8f865-3d0e-4a1f-a37c-1937fd504032`: PB14: verify primary/secondary role and support condition, tributary loads, transfer/point loads, flexure, shear, anchorage and reinforcement. Automatic sizing is a section envelope only.
- **REVIEW** — Ground floor / `700bada1-dddf-4d19-8f1a-9c415149a334`: PB15: verify primary/secondary role and support condition, tributary loads, transfer/point loads, flexure, shear, anchorage and reinforcement. Automatic sizing is a section envelope only.
- **REVIEW** — Ground floor / `2cd6e89e-4b92-41a5-b70a-a093fb617a6e`: PB16: verify primary/secondary role and support condition, tributary loads, transfer/point loads, flexure, shear, anchorage and reinforcement. Automatic sizing is a section envelope only.
- **REVIEW** — Ground floor / `a259ad99-38dd-4dd8-95cc-9fa51faea592`: PB17: verify primary/secondary role and support condition, tributary loads, transfer/point loads, flexure, shear, anchorage and reinforcement. Automatic sizing is a section envelope only.
- **REVIEW** — Ground floor / `fc42ba45-3940-4024-ac24-6e50ba4784ae`: PB18: startColumnId is unconnected; confirm joint/support type.
- **REVIEW** — Ground floor / `fc42ba45-3940-4024-ac24-6e50ba4784ae`: PB18: endColumnId is unconnected; confirm joint/support type.
- **REVIEW** — Ground floor / `fc42ba45-3940-4024-ac24-6e50ba4784ae`: PB18: verify primary/secondary role and support condition, tributary loads, transfer/point loads, flexure, shear, anchorage and reinforcement. Automatic sizing is a section envelope only.
- **REVIEW** — Ground floor / `556cd51f-dbbc-48c9-be5d-02aa8c812b4d`: PB19: verify primary/secondary role and support condition, tributary loads, transfer/point loads, flexure, shear, anchorage and reinforcement. Automatic sizing is a section envelope only.
- **REVIEW** — Ground floor / `8741dcc3-9ba6-442c-9080-d8a2d388ba06`: PB20: verify primary/secondary role and support condition, tributary loads, transfer/point loads, flexure, shear, anchorage and reinforcement. Automatic sizing is a section envelope only.
- **REVIEW** — Ground floor / `9ffc9b95-aa4d-469b-bac6-c52c3e602cce`: PB21: verify primary/secondary role and support condition, tributary loads, transfer/point loads, flexure, shear, anchorage and reinforcement. Automatic sizing is a section envelope only.
- **REVIEW** — Ground floor / `76678967-69cf-454d-aabd-e7a849a7d419`: PB22: verify primary/secondary role and support condition, tributary loads, transfer/point loads, flexure, shear, anchorage and reinforcement. Automatic sizing is a section envelope only.
- **REVIEW** — Ground floor / `a3ab7cb5-b38b-4421-a97f-93f0d8b2d0d2`: PB23: verify primary/secondary role and support condition, tributary loads, transfer/point loads, flexure, shear, anchorage and reinforcement. Automatic sizing is a section envelope only.
- **REVIEW** — Ground floor / `5e84df55-4457-4c79-94bf-73fc8342b288`: PB24: startColumnId is unconnected; confirm joint/support type.
- **REVIEW** — Ground floor / `5e84df55-4457-4c79-94bf-73fc8342b288`: PB24: endColumnId is unconnected; confirm joint/support type.
- **REVIEW** — Ground floor / `5e84df55-4457-4c79-94bf-73fc8342b288`: PB24: verify primary/secondary role and support condition, tributary loads, transfer/point loads, flexure, shear, anchorage and reinforcement. Automatic sizing is a section envelope only.
- **REVIEW** — Ground floor / `2f37ea3d-41e8-4a21-8cda-07ce3108444a`: SB3: startColumnId is unconnected; confirm joint/support type.
- **REVIEW** — Ground floor / `2f37ea3d-41e8-4a21-8cda-07ce3108444a`: SB3: verify primary/secondary role and support condition, tributary loads, transfer/point loads, flexure, shear, anchorage and reinforcement. Automatic sizing is a section envelope only.
- **REVIEW** — Ground floor / `875af433-f352-401e-8502-c7d9cff36c43`: B27: startColumnId is unconnected; confirm joint/support type.
- **REVIEW** — Ground floor / `875af433-f352-401e-8502-c7d9cff36c43`: B27: endColumnId is unconnected; confirm joint/support type.
- **REVIEW** — Ground floor / `875af433-f352-401e-8502-c7d9cff36c43`: B27: verify primary/secondary role and support condition, tributary loads, transfer/point loads, flexure, shear, anchorage and reinforcement. Automatic sizing is a section envelope only.
- **REVIEW** — Ground floor / `fd145f3b-d0ad-44f5-b3ac-d759d76b9f17`: B28: verify primary/secondary role and support condition, tributary loads, transfer/point loads, flexure, shear, anchorage and reinforcement. Automatic sizing is a section envelope only.
- **REVIEW** — Ground floor / `2c7e67e7-da01-4c33-8213-73bc166fef22`: B29: verify primary/secondary role and support condition, tributary loads, transfer/point loads, flexure, shear, anchorage and reinforcement. Automatic sizing is a section envelope only.
- **REVIEW** — Ground floor / `803ab9e7-fa6c-4886-b310-07c0042963bf`: B30: verify primary/secondary role and support condition, tributary loads, transfer/point loads, flexure, shear, anchorage and reinforcement. Automatic sizing is a section envelope only.
- **REVIEW** — Ground floor / `2415f078-96f3-4527-8eb4-cccab63a9b67`: B30: verify primary/secondary role and support condition, tributary loads, transfer/point loads, flexure, shear, anchorage and reinforcement. Automatic sizing is a section envelope only.
- **REVIEW** — Ground floor / `0b20d304-f577-43c6-859a-930ef1717623`: B31: verify primary/secondary role and support condition, tributary loads, transfer/point loads, flexure, shear, anchorage and reinforcement. Automatic sizing is a section envelope only.
- **REVIEW** — Ground floor / `e41b9838-a076-47ca-81b8-6f0749531acf`: B32: verify primary/secondary role and support condition, tributary loads, transfer/point loads, flexure, shear, anchorage and reinforcement. Automatic sizing is a section envelope only.
- **REVIEW** — Ground floor / `f8d7ae2b-39fe-4611-ae19-d8b014a2fb68`: B36: startColumnId is unconnected; confirm joint/support type.
- **REVIEW** — Ground floor / `f8d7ae2b-39fe-4611-ae19-d8b014a2fb68`: B36: endColumnId is unconnected; confirm joint/support type.
- **REVIEW** — Ground floor / `f8d7ae2b-39fe-4611-ae19-d8b014a2fb68`: B36: verify primary/secondary role and support condition, tributary loads, transfer/point loads, flexure, shear, anchorage and reinforcement. Automatic sizing is a section envelope only.
- **REVIEW** — Ground floor / `33e1efda-ccae-4029-abbb-1f1b40be1e16`: B37: startColumnId is unconnected; confirm joint/support type.
- **REVIEW** — Ground floor / `33e1efda-ccae-4029-abbb-1f1b40be1e16`: B37: endColumnId is unconnected; confirm joint/support type.
- **REVIEW** — Ground floor / `33e1efda-ccae-4029-abbb-1f1b40be1e16`: B37: verify primary/secondary role and support condition, tributary loads, transfer/point loads, flexure, shear, anchorage and reinforcement. Automatic sizing is a section envelope only.
- **REVIEW** — Ground floor / `03a85cc9-efc2-4110-b082-7b1634ec1e17`: B34: startColumnId is unconnected; confirm joint/support type.
- **REVIEW** — Ground floor / `03a85cc9-efc2-4110-b082-7b1634ec1e17`: B34: verify primary/secondary role and support condition, tributary loads, transfer/point loads, flexure, shear, anchorage and reinforcement. Automatic sizing is a section envelope only.
- **REVIEW** — Ground floor / `2d7dc950-ce79-4f60-ac29-7e38f84f3b5c`: B35: startColumnId is unconnected; confirm joint/support type.
- **REVIEW** — Ground floor / `2d7dc950-ce79-4f60-ac29-7e38f84f3b5c`: B35: verify primary/secondary role and support condition, tributary loads, transfer/point loads, flexure, shear, anchorage and reinforcement. Automatic sizing is a section envelope only.
- **REVIEW** — Ground floor / `19e375e3-ef0f-4e2f-a371-de257618b3e4`: B35: endColumnId is unconnected; confirm joint/support type.
- **REVIEW** — Ground floor / `19e375e3-ef0f-4e2f-a371-de257618b3e4`: B35: verify primary/secondary role and support condition, tributary loads, transfer/point loads, flexure, shear, anchorage and reinforcement. Automatic sizing is a section envelope only.
- **REVIEW** — Ground floor / `345f101d-0009-477f-bf0e-be81c9b46621`: B36: endColumnId is unconnected; confirm joint/support type.
- **REVIEW** — Ground floor / `345f101d-0009-477f-bf0e-be81c9b46621`: B36: verify primary/secondary role and support condition, tributary loads, transfer/point loads, flexure, shear, anchorage and reinforcement. Automatic sizing is a section envelope only.
- **REVIEW** — Ground floor / `9e9cacbc-0182-40a8-9e14-85dda7909471`: B37: endColumnId is unconnected; confirm joint/support type.
- **REVIEW** — Ground floor / `9e9cacbc-0182-40a8-9e14-85dda7909471`: B37: verify primary/secondary role and support condition, tributary loads, transfer/point loads, flexure, shear, anchorage and reinforcement. Automatic sizing is a section envelope only.
- **REVIEW** — Ground floor / `5e8e7212-4139-4ba2-a144-ee79fe2ec46c`: B38: endColumnId is unconnected; confirm joint/support type.
- **REVIEW** — Ground floor / `5e8e7212-4139-4ba2-a144-ee79fe2ec46c`: B38: verify primary/secondary role and support condition, tributary loads, transfer/point loads, flexure, shear, anchorage and reinforcement. Automatic sizing is a section envelope only.
- **REVIEW** — Ground floor / `6753e9bc-52ec-48a3-ab6c-b83065b620ce`: B39: endColumnId is unconnected; confirm joint/support type.
- **REVIEW** — Ground floor / `6753e9bc-52ec-48a3-ab6c-b83065b620ce`: B39: verify primary/secondary role and support condition, tributary loads, transfer/point loads, flexure, shear, anchorage and reinforcement. Automatic sizing is a section envelope only.
- **REVIEW** — Ground floor / `50ecb73c-2589-49e6-94f7-b5d50a5084b5`: B40: endColumnId is unconnected; confirm joint/support type.
- **REVIEW** — Ground floor / `50ecb73c-2589-49e6-94f7-b5d50a5084b5`: B40: verify primary/secondary role and support condition, tributary loads, transfer/point loads, flexure, shear, anchorage and reinforcement. Automatic sizing is a section envelope only.
- **REVIEW** — First floor / `919dhwt`: C1: height/minimum section exceeds 12; effective length and biaxial/slender design required.
- **REVIEW** — First floor / `fmkftrx`: C2: height/minimum section exceeds 12; effective length and biaxial/slender design required.
- **REVIEW** — First floor / `y6xrxhb`: C3: height/minimum section exceeds 12; effective length and biaxial/slender design required.
- **REVIEW** — First floor / `mdjeqrj`: C4: height/minimum section exceeds 12; effective length and biaxial/slender design required.
- **REVIEW** — First floor / `asls0ry`: C6: height/minimum section exceeds 12; effective length and biaxial/slender design required.
- **REVIEW** — First floor / `pbt2ggi`: C7: height/minimum section exceeds 12; effective length and biaxial/slender design required.
- **REVIEW** — First floor / `cey2w9x`: C8: height/minimum section exceeds 12; effective length and biaxial/slender design required.
- **REVIEW** — First floor / `xj6zjr4`: C10: height/minimum section exceeds 12; effective length and biaxial/slender design required.
- **REVIEW** — First floor / `j63g57y`: C11: height/minimum section exceeds 12; effective length and biaxial/slender design required.
- **REVIEW** — First floor / `q1qxujc`: C14: height/minimum section exceeds 12; effective length and biaxial/slender design required.
- **REVIEW** — First floor / `91nqut5`: C15: height/minimum section exceeds 12; effective length and biaxial/slender design required.
- **REVIEW** — First floor / `g1vypku`: C16: height/minimum section exceeds 12; effective length and biaxial/slender design required.
- **REVIEW** — First floor / `x0rnc4l`: C17: height/minimum section exceeds 12; effective length and biaxial/slender design required.
- **REVIEW** — First floor / `uxuqc8a`: C18: height/minimum section exceeds 12; effective length and biaxial/slender design required.
- **REVIEW** — First floor / `8nn31ua`: C19: height/minimum section exceeds 12; effective length and biaxial/slender design required.
- **REVIEW** — First floor / `5wenqia`: PB1: startColumnId is unconnected; confirm joint/support type.
- **REVIEW** — First floor / `5wenqia`: PB1: endColumnId is unconnected; confirm joint/support type.
- **REVIEW** — First floor / `5wenqia`: PB1: verify primary/secondary role and support condition, tributary loads, transfer/point loads, flexure, shear, anchorage and reinforcement. Automatic sizing is a section envelope only.
- **REVIEW** — First floor / `h1m6k12`: PB2: verify primary/secondary role and support condition, tributary loads, transfer/point loads, flexure, shear, anchorage and reinforcement. Automatic sizing is a section envelope only.
- **REVIEW** — First floor / `0q50hh8`: PB3: startColumnId is unconnected; confirm joint/support type.
- **REVIEW** — First floor / `0q50hh8`: PB3: endColumnId is unconnected; confirm joint/support type.
- **REVIEW** — First floor / `0q50hh8`: PB3: verify primary/secondary role and support condition, tributary loads, transfer/point loads, flexure, shear, anchorage and reinforcement. Automatic sizing is a section envelope only.
- **REVIEW** — First floor / `gownxlq`: PB4: verify primary/secondary role and support condition, tributary loads, transfer/point loads, flexure, shear, anchorage and reinforcement. Automatic sizing is a section envelope only.
- **REVIEW** — First floor / `b4gvh6c`: PB5: verify primary/secondary role and support condition, tributary loads, transfer/point loads, flexure, shear, anchorage and reinforcement. Automatic sizing is a section envelope only.
- **REVIEW** — First floor / `ojdvfjh`: PB7: startColumnId is unconnected; confirm joint/support type.
- **REVIEW** — First floor / `ojdvfjh`: PB7: endColumnId is unconnected; confirm joint/support type.
- **REVIEW** — First floor / `ojdvfjh`: PB7: verify primary/secondary role and support condition, tributary loads, transfer/point loads, flexure, shear, anchorage and reinforcement. Automatic sizing is a section envelope only.
- **REVIEW** — First floor / `gopx584`: PB8: verify primary/secondary role and support condition, tributary loads, transfer/point loads, flexure, shear, anchorage and reinforcement. Automatic sizing is a section envelope only.
- **REVIEW** — First floor / `8mdhwyq`: PB9: verify primary/secondary role and support condition, tributary loads, transfer/point loads, flexure, shear, anchorage and reinforcement. Automatic sizing is a section envelope only.
- **REVIEW** — First floor / `ampufvc`: PB11: verify primary/secondary role and support condition, tributary loads, transfer/point loads, flexure, shear, anchorage and reinforcement. Automatic sizing is a section envelope only.
- **REVIEW** — First floor / `6zr1d13`: PB12: verify primary/secondary role and support condition, tributary loads, transfer/point loads, flexure, shear, anchorage and reinforcement. Automatic sizing is a section envelope only.
- **REVIEW** — First floor / `zcgnlds`: PB13: verify primary/secondary role and support condition, tributary loads, transfer/point loads, flexure, shear, anchorage and reinforcement. Automatic sizing is a section envelope only.
- **REVIEW** — First floor / `0ii7z9x`: PB14: verify primary/secondary role and support condition, tributary loads, transfer/point loads, flexure, shear, anchorage and reinforcement. Automatic sizing is a section envelope only.
- **REVIEW** — First floor / `7azn0rq`: PB15: verify primary/secondary role and support condition, tributary loads, transfer/point loads, flexure, shear, anchorage and reinforcement. Automatic sizing is a section envelope only.
- **REVIEW** — First floor / `tgvsnpk`: PB16: verify primary/secondary role and support condition, tributary loads, transfer/point loads, flexure, shear, anchorage and reinforcement. Automatic sizing is a section envelope only.
- **REVIEW** — First floor / `e371pqc`: PB17: verify primary/secondary role and support condition, tributary loads, transfer/point loads, flexure, shear, anchorage and reinforcement. Automatic sizing is a section envelope only.
- **REVIEW** — First floor / `rfddi5q`: PB18: startColumnId is unconnected; confirm joint/support type.
- **REVIEW** — First floor / `rfddi5q`: PB18: endColumnId is unconnected; confirm joint/support type.
- **REVIEW** — First floor / `rfddi5q`: PB18: verify primary/secondary role and support condition, tributary loads, transfer/point loads, flexure, shear, anchorage and reinforcement. Automatic sizing is a section envelope only.
- **REVIEW** — First floor / `aqn738f`: PB19: verify primary/secondary role and support condition, tributary loads, transfer/point loads, flexure, shear, anchorage and reinforcement. Automatic sizing is a section envelope only.
- **REVIEW** — First floor / `kw7v4aa`: PB20: verify primary/secondary role and support condition, tributary loads, transfer/point loads, flexure, shear, anchorage and reinforcement. Automatic sizing is a section envelope only.
- **REVIEW** — First floor / `tndzr2o`: PB21: verify primary/secondary role and support condition, tributary loads, transfer/point loads, flexure, shear, anchorage and reinforcement. Automatic sizing is a section envelope only.
- **REVIEW** — First floor / `ubcadpv`: PB22: verify primary/secondary role and support condition, tributary loads, transfer/point loads, flexure, shear, anchorage and reinforcement. Automatic sizing is a section envelope only.
- **REVIEW** — First floor / `8mikoc5`: PB23: verify primary/secondary role and support condition, tributary loads, transfer/point loads, flexure, shear, anchorage and reinforcement. Automatic sizing is a section envelope only.
- **REVIEW** — First floor / `20afch8`: PB24: startColumnId is unconnected; confirm joint/support type.
- **REVIEW** — First floor / `20afch8`: PB24: endColumnId is unconnected; confirm joint/support type.
- **REVIEW** — First floor / `20afch8`: PB24: verify primary/secondary role and support condition, tributary loads, transfer/point loads, flexure, shear, anchorage and reinforcement. Automatic sizing is a section envelope only.
- **REVIEW** — First floor / `iy5so0m`: SB3: startColumnId is unconnected; confirm joint/support type.
- **REVIEW** — First floor / `iy5so0m`: SB3: verify primary/secondary role and support condition, tributary loads, transfer/point loads, flexure, shear, anchorage and reinforcement. Automatic sizing is a section envelope only.
- **REVIEW** — First floor / `5197d342-c4c7-434b-ad11-c5728ce42960`: B27: startColumnId is unconnected; confirm joint/support type.
- **REVIEW** — First floor / `5197d342-c4c7-434b-ad11-c5728ce42960`: B27: endColumnId is unconnected; confirm joint/support type.
- **REVIEW** — First floor / `5197d342-c4c7-434b-ad11-c5728ce42960`: B27: verify primary/secondary role and support condition, tributary loads, transfer/point loads, flexure, shear, anchorage and reinforcement. Automatic sizing is a section envelope only.
- **REVIEW** — First floor / `a69f9070-ffc0-48dd-8a73-d82ebbd69d75`: B28: verify primary/secondary role and support condition, tributary loads, transfer/point loads, flexure, shear, anchorage and reinforcement. Automatic sizing is a section envelope only.
- **REVIEW** — First floor / `534647ca-7cde-4d60-9624-eb54ec7325be`: B29: verify primary/secondary role and support condition, tributary loads, transfer/point loads, flexure, shear, anchorage and reinforcement. Automatic sizing is a section envelope only.
- **REVIEW** — First floor / `9c296b5b-bdc3-47a5-bb2e-4418420c5a78`: B30: verify primary/secondary role and support condition, tributary loads, transfer/point loads, flexure, shear, anchorage and reinforcement. Automatic sizing is a section envelope only.
- **REVIEW** — First floor / `bf6e7d71-c047-47c5-bdff-20842e386d98`: B30: verify primary/secondary role and support condition, tributary loads, transfer/point loads, flexure, shear, anchorage and reinforcement. Automatic sizing is a section envelope only.
- **REVIEW** — First floor / `7dfaea92-1c3c-4e2d-b039-ce69663a02e3`: B31: verify primary/secondary role and support condition, tributary loads, transfer/point loads, flexure, shear, anchorage and reinforcement. Automatic sizing is a section envelope only.
- **REVIEW** — First floor / `fc1baf08-53b7-45cb-9f7f-3905f28671b2`: B32: verify primary/secondary role and support condition, tributary loads, transfer/point loads, flexure, shear, anchorage and reinforcement. Automatic sizing is a section envelope only.
- **REVIEW** — First floor / `cfadedaa-212f-4434-ad1c-c2a690e0a826`: B36: startColumnId is unconnected; confirm joint/support type.
- **REVIEW** — First floor / `cfadedaa-212f-4434-ad1c-c2a690e0a826`: B36: endColumnId is unconnected; confirm joint/support type.
- **REVIEW** — First floor / `cfadedaa-212f-4434-ad1c-c2a690e0a826`: B36: verify primary/secondary role and support condition, tributary loads, transfer/point loads, flexure, shear, anchorage and reinforcement. Automatic sizing is a section envelope only.
- **REVIEW** — First floor / `011083ec-767c-4c0c-8ee9-2cc33d4b52cb`: B37: startColumnId is unconnected; confirm joint/support type.
- **REVIEW** — First floor / `011083ec-767c-4c0c-8ee9-2cc33d4b52cb`: B37: endColumnId is unconnected; confirm joint/support type.
- **REVIEW** — First floor / `011083ec-767c-4c0c-8ee9-2cc33d4b52cb`: B37: verify primary/secondary role and support condition, tributary loads, transfer/point loads, flexure, shear, anchorage and reinforcement. Automatic sizing is a section envelope only.
- **REVIEW** — First floor / `899256dc-ff76-4db7-bdc7-63733032ebb5`: B34: startColumnId is unconnected; confirm joint/support type.
- **REVIEW** — First floor / `899256dc-ff76-4db7-bdc7-63733032ebb5`: B34: verify primary/secondary role and support condition, tributary loads, transfer/point loads, flexure, shear, anchorage and reinforcement. Automatic sizing is a section envelope only.
- **REVIEW** — First floor / `16906145-eaf6-46df-b911-9b8a1d39acd4`: B35: startColumnId is unconnected; confirm joint/support type.
- **REVIEW** — First floor / `16906145-eaf6-46df-b911-9b8a1d39acd4`: B35: verify primary/secondary role and support condition, tributary loads, transfer/point loads, flexure, shear, anchorage and reinforcement. Automatic sizing is a section envelope only.
- **REVIEW** — First floor / `dcf8b331-48a2-4884-a8ea-523ef31bdcf6`: B35: endColumnId is unconnected; confirm joint/support type.
- **REVIEW** — First floor / `dcf8b331-48a2-4884-a8ea-523ef31bdcf6`: B35: verify primary/secondary role and support condition, tributary loads, transfer/point loads, flexure, shear, anchorage and reinforcement. Automatic sizing is a section envelope only.
- **REVIEW** — First floor / `440a49eb-59aa-45e3-9564-6d44d2520697`: B36: endColumnId is unconnected; confirm joint/support type.
- **REVIEW** — First floor / `440a49eb-59aa-45e3-9564-6d44d2520697`: B36: verify primary/secondary role and support condition, tributary loads, transfer/point loads, flexure, shear, anchorage and reinforcement. Automatic sizing is a section envelope only.
- **REVIEW** — First floor / `49dceb44-2706-4c7c-b428-ef1552b4f36a`: B37: endColumnId is unconnected; confirm joint/support type.
- **REVIEW** — First floor / `49dceb44-2706-4c7c-b428-ef1552b4f36a`: B37: verify primary/secondary role and support condition, tributary loads, transfer/point loads, flexure, shear, anchorage and reinforcement. Automatic sizing is a section envelope only.
- **REVIEW** — First floor / `715b87cc-a6ed-4fd3-b2a3-69eaa84deee7`: B38: endColumnId is unconnected; confirm joint/support type.
- **REVIEW** — First floor / `715b87cc-a6ed-4fd3-b2a3-69eaa84deee7`: B38: verify primary/secondary role and support condition, tributary loads, transfer/point loads, flexure, shear, anchorage and reinforcement. Automatic sizing is a section envelope only.
- **REVIEW** — First floor / `38da54fd-cf3b-41cf-9faf-4e131fd157f1`: B39: endColumnId is unconnected; confirm joint/support type.
- **REVIEW** — First floor / `38da54fd-cf3b-41cf-9faf-4e131fd157f1`: B39: verify primary/secondary role and support condition, tributary loads, transfer/point loads, flexure, shear, anchorage and reinforcement. Automatic sizing is a section envelope only.
- **REVIEW** — First floor / `c36c8c29-be1d-4d2a-9e45-37de8dfd8b4c`: B40: endColumnId is unconnected; confirm joint/support type.
- **REVIEW** — First floor / `c36c8c29-be1d-4d2a-9e45-37de8dfd8b4c`: B40: verify primary/secondary role and support condition, tributary loads, transfer/point loads, flexure, shear, anchorage and reinforcement. Automatic sizing is a section envelope only.
- **REVIEW** — Floor 2: Floor 2: no columns modelled. Confirm whether this floor needs framing; floor count alone does not add a load-bearing storey.
- **REVIEW** — Building: Soil class and bearing capacity are provisional; attach the site investigation.
- **REVIEW** — Building: Equivalent-static method is outside the IS 1893:2016 clause 7.6 eligibility; dynamic analysis is required.
- **REVIEW** — Building: Verify structural system, R, IS 13920 detailing, consolidated seismic amendments and the current IS 875 unit-weight tables. No full code-compliance determination is computed.
- **REVIEW** — Building: Column/wall mass is apportioned between bounding floors. Verify roof flags, imposed-load use and the clause 7.3.6 minimum partition allowance (0.5 kN/m² where applicable).
- **REVIEW** — First floor: Adjacent storey mass ratio exceeds 1.5: inspect mass irregularity.
- **REVIEW** — Floor 2: Adjacent storey mass ratio exceeds 1.5: inspect mass irregularity.

## Required engineering design

- Gravity slab/beam load distribution and bending/shear design — not computed.
- Biaxial and slender column design — not computed.
- Joint shear, anchorage, confinement and IS 13920 detailing — not computed.
- Diaphragm shell, amplified static eccentricity, P-delta and foundation design — not computed.

Full numerical inputs, checks and every changed property are in `structural-draft-report.json`.
