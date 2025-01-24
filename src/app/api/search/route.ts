import { NextResponse } from 'next/server';
import { blogs } from '@/data/blogs';
import { projects } from '@/data/projects';

// Simple search index
const searchIndex = {
    blogs: blogs.map(blog => ({
        id: blog.id,
        type: 'blog',
        title: blog.title,
        content: blog.content,
        description: blog.description,
        tags: blog.tags,
        url: `/blogs/${blog.id}`,
        date: blog.date
    })),
    projects: projects.map(project => ({
        id: project.id,
        type: 'project',
        title: project.title,
        description: project.description,
        tags: project.tags,
        url: `/projects#${project.id}`,
        technologies: project.technologies
    }))
};

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.toLowerCase();
    const type = searchParams.get('type'); // Optional filter by type

    if (!query) {
        return NextResponse.json({ results: [] });
    }

    let results = [];

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
            return titleMatch || descMatch || techMatch;
        });
        results.push(...projectResults);
    }

    // Sort results by relevance (title matches first, then content matches)
    results.sort((a, b) => {
        const aTitle = a.title.toLowerCase();
        const bTitle = b.title.toLowerCase();
        const aTitleMatch = aTitle.includes(query);
        const bTitleMatch = bTitle.includes(query);

        if (aTitleMatch && !bTitleMatch) return -1;
        if (!aTitleMatch && bTitleMatch) return 1;

        // If both match or don't match title, sort by date if available
        if (a.date && b.date) {
            return new Date(b.date).getTime() - new Date(a.date).getTime();
        }

        return 0;
    });

    return NextResponse.json({
        results: results.slice(0, 10) // Limit to top 10 results
    });
} 