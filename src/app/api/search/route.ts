import { NextResponse } from 'next/server';
import { blogs } from '@/data/blogs';
import { projects } from '@/data/projects';

interface BlogSearchItem {
    id: string;
    type: 'blog';
    title: string;
    content: string;
    description: string;
    tags?: string[];
    url: string;
    date: string;
}

interface ProjectSearchItem {
    id: string;
    type: 'project';
    title: string;
    description: string;
    tags: string[];
    url: string;
    technologies: string[];
}

type SearchItem = BlogSearchItem | ProjectSearchItem;

// Simple search index
const searchIndex = {
    blogs: blogs.map(blog => ({
        id: blog.id,
        type: 'blog' as const,
        title: blog.title,
        content: blog.content,
        description: blog.description,
        tags: blog.tags,
        url: `/blogs/${blog.id}`,
        date: blog.date
    })),
    projects: projects.map(project => ({
        id: project.title.toLowerCase().replace(/\s+/g, '-'),
        type: 'project' as const,
        title: project.title,
        description: project.description,
        tags: [project.year],
        url: `/projects#${project.title.toLowerCase().replace(/\s+/g, '-')}`,
        technologies: project.subtext.split(',').map(tech => tech.trim())
    }))
};

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.toLowerCase();
    const type = searchParams.get('type');

    if (!query) {
        return NextResponse.json({ results: [] });
    }

    let results: SearchItem[] = [];

    // Search in blogs
    if (!type || type === 'blog') {
        const blogResults = searchIndex.blogs.filter(item => {
            const titleMatch = item.title.toLowerCase().includes(query);
            const contentMatch = item.content.toLowerCase().includes(query);
            const tagMatch = item.tags?.some(tag => tag.toLowerCase().includes(query));
            return titleMatch || contentMatch || tagMatch;
        });
        results.push(...blogResults);
    }

    // Search in projects
    if (!type || type === 'project') {
        const projectResults = searchIndex.projects.filter(item => {
            const titleMatch = item.title.toLowerCase().includes(query);
            const descMatch = item.description.toLowerCase().includes(query);
            const techMatch = item.technologies?.some(tech => 
                tech.toLowerCase().includes(query)
            );
            const yearMatch = item.tags?.some(tag => tag.includes(query));
            return titleMatch || descMatch || techMatch || yearMatch;
        });
        results.push(...projectResults);
    }

    // Sort results by relevance
    results.sort((a, b) => {
        // First, sort by title match
        const aTitle = a.title.toLowerCase();
        const bTitle = b.title.toLowerCase();
        const aTitleMatch = aTitle.includes(query);
        const bTitleMatch = bTitle.includes(query);

        if (aTitleMatch && !bTitleMatch) return -1;
        if (!aTitleMatch && bTitleMatch) return 1;

        // Then, prioritize blogs over projects
        if (a.type === 'blog' && b.type === 'project') return -1;
        if (a.type === 'project' && b.type === 'blog') return 1;

        // For blogs, sort by date
        if (a.type === 'blog' && b.type === 'blog') {
            return new Date(b.date).getTime() - new Date(a.date).getTime();
        }

        // For projects, sort by year tag
        if (a.type === 'project' && b.type === 'project') {
            return b.tags[0].localeCompare(a.tags[0]); // Compare years
        }

        return 0;
    });

    return NextResponse.json({
        results: results.slice(0, 10)
    });
} 