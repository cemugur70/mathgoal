import asyncio
import time
import sys

# we need to ensure the environment is set up
# Let's import the function
try:
    from hybrid_scraper import run_hybrid_scraper
except ImportError:
    print("Cannot import run_hybrid_scraper")
    sys.exit(1)

# we need fake config/common_scraper perhaps? Let's check if hybrid_scraper can be imported and run.
async def main():
    test_ids = ["SS3W5yS8", "pYP9mZXF", "d61T2Y1h", "M5BfG7lO"] # some flashscore ids, maybe we should just use the ones in test_ids
    bookmakers = ["bet365"]
    bet_types = {}

    start_time = time.time()
    await run_hybrid_scraper(test_ids, bookmakers, bet_types, "bench_output.xlsx", max_concurrent=4)
    end_time = time.time()
    print(f"Execution time: {end_time - start_time:.4f} seconds")

if __name__ == "__main__":
    asyncio.run(main())
