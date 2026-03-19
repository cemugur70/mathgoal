## 2026-03-05 - [Parallelizing Independent Database Queries]
**Learning:** In the /api/matches endpoint, a COUNT query and a paginated SELECT query were being executed sequentially, increasing the response time unnecessarily.
**Action:** Use Promise.all() to execute independent database queries concurrently, reducing overall latency without affecting correctness.
