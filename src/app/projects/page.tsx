import React from 'react';
import {Card, CardContent} from "@/components/ui/card";
import {PageWrapper} from "@/components/page-wrappper";

const projects = [
    {
        title: 'Hereme',
        description: 'Ready-to-use UI elements designed for rapid development.'
    },
    {
        title: 'Prettyfolio',
        description: 'A curated collection of portfolios for inspiration.'
    },
    {
        title: 'Enchant',
        description: 'A vibrant theme for Visual Studio Code.'
    }

]

const Project = () => {
  return (
      <PageWrapper>
          <div className="max-w-4xl mx-auto p-4 pt-0 sm:p-8">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {projects.map((project) => (
                        <Card className="w-full" key={project.title}>
                            <CardContent>
                                <h3 className="font-bold pt-4">{project.title}</h3>
                                <p className="pt-4">{project.description}</p>
                            </CardContent>
                        </Card>
                  ))}

              </div>
          </div>
      </PageWrapper>

  );
};

export default Project;