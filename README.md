# trending-data branch

This is an orphan branch that exists only to hold trending capture data.

- Scraped every 15 min by .github/workflows/trending-15min.yml
- Data files at data/trending/YYYY-MM-DD.json
- Read by main branch's daily 02:00 UTC refresh, aggregated into web.json

Don't merge this branch into main. Don't manually push code to it (other than the capture script itself).
