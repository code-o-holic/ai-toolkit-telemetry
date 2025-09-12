"use client";
import { ReactNode } from 'react';
import { TopBar, MainContent } from '@/components/layout';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import AddImagesModal from '@/components/AddImagesModal';

const steps = [
  { name: 'Prepare Dataset', href: '/workflow/step1-upload' },
  { name: 'Caption', href: '/workflow/step2-caption' },
  { name: 'Review & Lock', href: '/workflow/step3-review' },
  { name: 'Configure & Train', href: '/workflow/step4-train' },
];

export default function WorkflowLayout({ children }: { children: ReactNode }) {
  const params = useSearchParams();
  const dataset = params.get('dataset');
  return (
    <>
      <TopBar>
        <div className="text-gray-200 font-medium">Workflow</div>
        <div className="flex-1" />
        <div className="flex items-center gap-2 pr-2 overflow-x-auto">
          {steps.map((step, idx) => {
            const href = dataset ? `${step.href}?dataset=${encodeURIComponent(dataset)}` : step.href;
            return (
              <Link key={step.name} href={href} className="px-3 py-1 rounded-md bg-gray-800 text-gray-200 whitespace-nowrap">
                {idx + 1}. {step.name}
              </Link>
            );
          })}
        </div>
      </TopBar>
      <MainContent>
        {children}
      </MainContent>
      <AddImagesModal />
    </>
  );
}


