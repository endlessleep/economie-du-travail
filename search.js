document.addEventListener("DOMContentLoaded", () => {
    const searchInput = document.getElementById("course-search-input");
    const searchResultsContainer = document.getElementById("search-results");
    
    if (!searchInput || !searchResultsContainer) return;

    let searchIndex = null;
    let isFetching = false;

    // List of all course files to index
    const filesToIndex = [
        "index.html",
        "cours-2.html", "cours-3.html", "cours-4.html", "cours-5.html",
        "cours-6.html", "cours-7.html", "cours-8.html", "cours-9.html",
        "cours-10.html", "cours-11.html"
    ];

    async function buildSearchIndex() {
        if (searchIndex || isFetching) return;
        isFetching = true;
        
        // Show loading state if user typed something while fetching
        if (searchInput.value.trim().length >= 2) {
            searchResultsContainer.innerHTML = '<div class="search-loading">Building index...</div>';
            searchResultsContainer.style.display = "block";
        }

        try {
            const index = [];
            const parser = new DOMParser();

            const fetchPromises = filesToIndex.map(async (filename) => {
                try {
                    const response = await fetch(filename);
                    if (!response.ok) return;
                    
                    const htmlText = await response.text();
                    const doc = parser.parseFromString(htmlText, "text/html");
                    
                    // Extract title from h1
                    const titleElement = doc.querySelector(".page-header h1");
                    const pageTitle = titleElement ? titleElement.textContent.trim() : filename;

                    // Extract text content from main content area
                    const mainContent = doc.querySelector(".main-content");
                    if (!mainContent) return;

                    // We want to index logical blocks (paragraphs, list items, headers)
                    const elements = mainContent.querySelectorAll("p, li, h2, h3, h4");
                    
                    elements.forEach(el => {
                        // Avoid indexing code blocks or math purely
                        if (el.closest('.math-block') || el.closest('script')) return;
                        
                        const text = el.textContent.replace(/\s+/g, " ").trim();
                        if (text.length > 20) {
                            index.push({
                                filename: filename,
                                title: pageTitle,
                                content: text
                            });
                        }
                    });
                } catch (e) {
                    console.warn("Could not fetch " + filename, e);
                }
            });

            await Promise.all(fetchPromises);
            searchIndex = index;
            isFetching = false;
            
            // Re-trigger search if input has value
            handleSearch();

        } catch (error) {
            console.error("Error building search index:", error);
            isFetching = false;
            searchResultsContainer.innerHTML = '<div class="search-error">Could not build search index.</div>';
        }
    }

    function escapeHtml(unsafe) {
        return unsafe
             .replace(/&/g, "&amp;")
             .replace(/</g, "&lt;")
             .replace(/>/g, "&gt;")
             .replace(/"/g, "&quot;")
             .replace(/'/g, "&#039;");
    }

    function highlightKeyword(text, keyword) {
        const regex = new RegExp(`(${keyword})`, 'gi');
        // We only want a snippet around the first match
        const match = regex.exec(text);
        if (!match) return escapeHtml(text.substring(0, 100)) + "...";
        
        const index = match.index;
        const start = Math.max(0, index - 40);
        const end = Math.min(text.length, index + keyword.length + 40);
        
        let snippet = text.substring(start, end);
        if (start > 0) snippet = "..." + snippet;
        if (end < text.length) snippet = snippet + "...";

        // Highlight safely
        snippet = escapeHtml(snippet);
        const escapedKeyword = escapeHtml(keyword);
        const replaceRegex = new RegExp(`(${escapedKeyword})`, 'gi');
        
        return snippet.replace(replaceRegex, '<span class="search-highlight">$1</span>');
    }

    function handleSearch() {
        const query = searchInput.value.trim().toLowerCase();
        
        if (query.length < 2) {
            searchResultsContainer.style.display = "none";
            return;
        }

        if (!searchIndex) {
            buildSearchIndex();
            return;
        }

        // Search logic
        const results = [];
        const seenFiles = new Set();
        
        for (const item of searchIndex) {
            if (item.content.toLowerCase().includes(query) || item.title.toLowerCase().includes(query)) {
                // Limit to max 2 results per file to avoid flooding
                const fileCount = Array.from(seenFiles).filter(x => x === item.filename).length;
                if (fileCount < 2) {
                    results.push(item);
                    seenFiles.add(item.filename);
                }
                
                if (results.length >= 8) break; // Max 8 results total
            }
        }

        renderResults(results, query);
    }

    function renderResults(results, query) {
        if (results.length === 0) {
            searchResultsContainer.innerHTML = '<div class="search-no-results">No results found for "'+ escapeHtml(query) +'"</div>';
            searchResultsContainer.style.display = "block";
            return;
        }

        let html = '';
        results.forEach(res => {
            const snippetText = highlightKeyword(res.content, query);
            const urlSnip = res.content.substring(0, 35).trim();
            html += `
                <a href="${res.filename}?sq=${encodeURIComponent(query)}&snip=${encodeURIComponent(urlSnip)}" class="search-result-item">
                    <div class="search-result-title">${escapeHtml(res.title)}</div>
                    <div class="search-result-snippet">${snippetText}</div>
                </a>
            `;
        });

        searchResultsContainer.innerHTML = html;
        searchResultsContainer.style.display = "block";
    }

    // Event Listeners
    searchInput.addEventListener("focus", buildSearchIndex);
    searchInput.addEventListener("input", handleSearch);
    
    // Close dropdown when clicking outside
    document.addEventListener("click", (e) => {
        if (!searchInput.contains(e.target) && !searchResultsContainer.contains(e.target)) {
            searchResultsContainer.style.display = "none";
        }
    });
    
    // Re-open if clicking on input and there is text
    searchInput.addEventListener("click", () => {
        if (searchInput.value.trim().length >= 2) {
            searchResultsContainer.style.display = "block";
        }
    });

    // Auto-scroll and highlight if coming from a search result
    const urlParams = new URLSearchParams(window.location.search);
    const sq = urlParams.get('sq');
    const snip = urlParams.get('snip');
    
    if (sq && snip) {
        // Wait a tiny bit for the page to render fully
        setTimeout(() => {
            const elements = document.querySelectorAll(".main-content p, .main-content li, .main-content h2, .main-content h3, .main-content h4, .concept-card");
            for (const el of elements) {
                const text = el.textContent.replace(/\s+/g, " ").trim();
                // If this element's text starts with or contains our 35-char snippet
                if (text.includes(snip)) {
                    // Scroll to the exact paragraph/element
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    
                    // Temporarily highlight the background to show the user exactly where to look
                    const originalBg = el.style.backgroundColor;
                    const originalTransition = el.style.transition;
                    
                    el.style.transition = "background-color 0.5s ease";
                    el.style.backgroundColor = "rgba(254, 252, 191, 0.8)"; // bright yellow
                    el.style.borderRadius = "6px";
                    
                    // Fade out the highlight after 2.5 seconds
                    setTimeout(() => {
                        el.style.backgroundColor = originalBg || "transparent";
                        setTimeout(() => {
                            el.style.transition = originalTransition;
                            // Clean up URL so refresh doesn't trigger scroll again
                            const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
                            window.history.replaceState({path: cleanUrl}, '', cleanUrl);
                        }, 500);
                    }, 2500);
                    
                    break;
                }
            }
        }, 150);
    }
});
