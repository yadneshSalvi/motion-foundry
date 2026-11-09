# Host Preview timing

A recorded five-second window inspected the moving mechanism at close range in Lens Studio Preview. Across 222 `UpdateEvent` intervals, the median was 22.23 ms, the 95th percentile 24.47 ms and the maximum 63.84 ms; two intervals exceeded 33 ms. Diagnostics, logging and silent screen recording were active.

| Measurement | Recorded value |
| --- | --- |
| Window | 5.0226 seconds |
| Samples | 222 |
| Median | 22.226458 ms |
| 95th percentile | 24.469000 ms |
| Maximum | 63.841917 ms |

These are desktop host update intervals, not render/GPU timing or physical-glasses FPS. The [curated receipt](host-preview-timing-r004.json) binds the measurement to the actual product 012/source 013 recording and input. It retains the maximum and the original quantile method.

Twenty separate state observations show that the machine was playing in the near view with the same drawing. At least two rod labels were visible in each observation; the widest-gap plate appeared in 16 of 20. These state observations do not establish that every host frame was inspected.
