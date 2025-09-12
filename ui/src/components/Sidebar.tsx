import Link from 'next/link';
import { Home, Settings, BrainCircuit, Images, Plus, ListChecks, Type, Lock, Play, LineChart } from 'lucide-react';
import { FaXTwitter, FaDiscord, FaYoutube } from "react-icons/fa6";

const Sidebar = () => {
  const workflowNav = [
    { name: 'Prepare Dataset', href: '/workflow/step1-upload', icon: ListChecks },
    { name: 'Caption', href: '/workflow/step2-caption', icon: Type },
    { name: 'Review & Lock', href: '/workflow/step3-review', icon: Lock },
    { name: 'Configure & Train', href: '/workflow/step4-train', icon: Play },
  ];

  const manageNav = [
    { name: 'Dashboard', href: '/dashboard', icon: Home },
    { name: 'New Job', href: '/jobs/new', icon: Plus },
    { name: 'Training Jobs', href: '/jobs', icon: BrainCircuit },
    { name: 'Datasets', href: '/datasets', icon: Images },
    { name: 'Metrics', href: '/metrics', icon: LineChart },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  const socialsBoxClass = 'flex flex-col items-center justify-center p-1 hover:bg-gray-800 rounded-lg transition-colors';
  const socialIconClass = 'w-5 h-5 text-gray-400 hover:text-white';

  return (
    <div className="flex flex-col w-59 bg-gray-900 text-gray-100">
      <div className="px-4 py-3">
        <h1 className="text-l">
          <img src="/ostris_logo.png" alt="Ostris AI Toolkit" className="w-auto h-7 mr-3 inline" />
          <span className="font-bold uppercase">Ostris</span>
          <span className="ml-2 uppercase text-gray-300">AI-Toolkit</span>
        </h1>
      </div>
      <nav className="flex-1">
        <div className="px-3 py-2 text-xs uppercase tracking-wide text-gray-400">Workflow</div>
        <ul className="px-2 space-y-2">
          {workflowNav.map(item => (
            <li key={item.name}>
              <Link
                href={item.href}
                className="flex items-center px-4 py-2 text-gray-200 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <item.icon className="w-5 h-5 mr-3" />
                {item.name}
              </Link>
            </li>
          ))}
        </ul>

        <div className="px-3 py-3 text-xs uppercase tracking-wide text-gray-400">Management</div>
        <ul className="px-2 space-y-2">
          {manageNav.map(item => (
            <li key={item.name}>
              <Link
                href={item.href}
                className="flex items-center px-4 py-2 text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <item.icon className="w-5 h-5 mr-3" />
                {item.name}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <a
        href="https://ostris.com/support"
        target="_blank"
        rel="noreferrer"
        className="flex items-center space-x-2 px-4 py-3"
      >
        <div className="min-w-[26px] min-h-[26px]">
          <svg height="24" version="1.1" width="24" xmlns="http://www.w3.org/2000/svg">
            <g transform="translate(0 -1028.4)">
              <path
                d="m7 1031.4c-1.5355 0-3.0784 0.5-4.25 1.7-2.3431 2.4-2.2788 6.1 0 8.5l9.25 9.8 9.25-9.8c2.279-2.4 2.343-6.1 0-8.5-2.343-2.3-6.157-2.3-8.5 0l-0.75 0.8-0.75-0.8c-1.172-1.2-2.7145-1.7-4.25-1.7z"
                fill="#c0392b"
              />
            </g>
          </svg>
        </div>
        <div className="uppercase text-gray-500 text-sm mb-2 flex-1 pt-2 pl-0">Support AI-Toolkit</div>
      </a>

      {/* Social links grid */}
      <div className="px-1 py-1 border-t border-gray-800">
        <div className="grid grid-cols-3 gap-4">
          <a
            href="https://discord.gg/VXmU2f5WEU"
            target="_blank"
            rel="noreferrer"
            className={socialsBoxClass}
          >
            <FaDiscord className={socialIconClass} />
            {/* <span className="text-xs text-gray-500 mt-1">Discord</span> */}
          </a>
          <a
            href="https://www.youtube.com/@ostrisai"
            target="_blank"
            rel="noreferrer"
            className={socialsBoxClass}
          >
            <FaYoutube className={socialIconClass} />
            {/* <span className="text-xs text-gray-500 mt-1">YouTube</span> */}
          </a>
          <a
            href="https://x.com/ostrisai"
            target="_blank"
            rel="noreferrer"
            className={socialsBoxClass}
          >
            <FaXTwitter className={socialIconClass} />
            {/* <span className="text-xs text-gray-500 mt-1">X</span> */}
          </a>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
