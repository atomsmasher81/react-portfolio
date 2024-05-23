import React from 'react';
import {Card, CardContent} from "@/components/ui/card";

const Blog = () => {
  return (
    <div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="w-full">
                <CardContent>
                    {/*<CodeIcon className="h-6 w-6 mb-2" />*/}
                    <h3 className="font-bold">syntaxUI</h3>
                    <p>Ready-to-use UI elements designed for rapid development.</p>
                </CardContent>
            </Card>
            <Card className="w-full">
                <CardContent>
                    {/*<ImageIcon className="h-6 w-6 mb-2" />*/}
                    <h3 className="font-bold">Prettyfolio</h3>
                    <p>A curated collection of portfolios for inspiration.</p>
                </CardContent>
            </Card>
            <Card className="w-full">
                <CardContent>
                    {/*<EggIcon className="h-6 w-6 mb-2" />*/}
                    <h3 className="font-bold">Enchant</h3>
                    <p>A vibrant theme for Visual Studio Code.</p>
                </CardContent>
            </Card>
        </div>
    </div>
  );
};

export default Blog;