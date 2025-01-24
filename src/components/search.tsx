import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

interface SearchResult {
    id: string;
    type: 'blog' | 'project';
    title: string;
    description?: string;
    url: string;
    tags?: string[];
}

export function Search() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);
    const router = useRouter();

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setShowResults(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        const searchItems = async () => {
            if (query.length < 2) {
                setResults([]);
                return;
            }

            setIsLoading(true);
            try {
                const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
                const data = await response.json();
                setResults(data.results);
            } catch (error) {
                console.error('Search error:', error);
                setResults([]);
            } finally {
                setIsLoading(false);
            }
        };

        const debounceTimer = setTimeout(searchItems, 300);
        return () => clearTimeout(debounceTimer);
    }, [query]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && results.length > 0) {
            router.push(results[0].url);
            setShowResults(false);
        }
    };

    return (
        <div className="relative" ref={searchRef}>
            <div className="relative">
                <input
                    type="search"
                    placeholder="Search blogs and projects..."
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setShowResults(true);
                    }}
                    onKeyDown={handleKeyDown}
                    className="w-full px-4 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    aria-label="Search"
                />
                {isLoading && (
                    <div className="absolute right-3 top-2.5">
                        <div className="w-5 h-5 border-t-2 border-blue-500 rounded-full animate-spin"></div>
                    </div>
                )}
            </div>

            <AnimatePresence>
                {showResults && (results.length > 0 || query.length >= 2) && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute z-50 w-full mt-2 bg-white rounded-lg shadow-lg border"
                    >
                        {results.length > 0 ? (
                            <ul className="py-2">
                                {results.map((result) => (
                                    <li key={`${result.type}-${result.id}`}>
                                        <Link
                                            href={result.url}
                                            onClick={() => setShowResults(false)}
                                            className="block px-4 py-2 hover:bg-gray-100"
                                        >
                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <h3 className="font-medium">{result.title}</h3>
                                                    {result.description && (
                                                        <p className="text-sm text-gray-600 line-clamp-2">
                                                            {result.description}
                                                        </p>
                                                    )}
                                                </div>
                                                <span className="text-xs text-gray-500 capitalize ml-2">
                                                    {result.type}
                                                </span>
                                            </div>
                                            {result.tags && result.tags.length > 0 && (
                                                <div className="mt-1 flex flex-wrap gap-1">
                                                    {result.tags.map(tag => (
                                                        <span
                                                            key={tag}
                                                            className="px-2 py-0.5 text-xs bg-gray-100 rounded-full"
                                                        >
                                                            {tag}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div className="px-4 py-3 text-sm text-gray-600">
                                No results found for "{query}"
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
} 