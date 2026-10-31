import React from"react";
import {
 PlusCircle,
 Heading,
 Image as ImageIcon,
 Youtube,
 Split,
 FolderPlus,
} from"lucide-react";

interface FloatingToolbarProps {
 onAddQuestion: (type?: string) => void;
 onAddTitleDesc: () => void;
 onAddImage: () => void;
 onAddVideo: () => void;
 onAddSection: () => void;
}

export const FloatingToolbar: React.FC<FloatingToolbarProps> = ({
 onAddQuestion,
 onAddTitleDesc,
 onAddImage,
 onAddVideo,
 onAddSection,
}) => {
 return (
 <div className="fixed sm:sticky bottom-4 sm:bottom-auto left-1/2 -translate-x-1/2 sm:translate-x-0 sm:left-auto sm:right-auto sm:top-28 z-40 flex sm:flex-col items-center gap-1 sm:gap-1.5 p-1.5 bg-white/95 sm:bg-white backdrop-blur sm:backdrop-blur-none border border-neutral-200 rounded-2xl shadow-xl shadow-neutral-400/20 max-w-[calc(100vw-32px)]">
 <button
 onClick={() => onAddQuestion("multiple_choice")}
 title="Add Question"
 className="p-2.5 text-neutral-700 hover:text-flamingo hover:bg-flamingo/10 rounded-xl transition active:scale-95 group relative"
 >
 <PlusCircle className="w-5 h-5"/>
 <span className="hidden sm:group-hover:block absolute left-full ml-2 px-2 py-1 bg-neutral-900 text-white text-[11px] font-medium rounded shadow-lg whitespace-nowrap z-50">
 Add question
 </span>
 </button>

 <button
 onClick={onAddTitleDesc}
 title="Add Title & Description"
 className="p-2.5 text-neutral-700 hover:text-flamingo hover:bg-flamingo/10 rounded-xl transition active:scale-95 group relative"
 >
 <Heading className="w-5 h-5"/>
 <span className="hidden sm:group-hover:block absolute left-full ml-2 px-2 py-1 bg-neutral-900 text-white text-[11px] font-medium rounded shadow-lg whitespace-nowrap z-50">
 Add title and description
 </span>
 </button>

 <button
 onClick={onAddImage}
 title="Add Image Block"
 className="p-2.5 text-neutral-700 hover:text-flamingo hover:bg-flamingo/10 rounded-xl transition active:scale-95 group relative"
 >
 <ImageIcon className="w-5 h-5"/>
 <span className="hidden sm:group-hover:block absolute left-full ml-2 px-2 py-1 bg-neutral-900 text-white text-[11px] font-medium rounded shadow-lg whitespace-nowrap z-50">
 Add image
 </span>
 </button>

 <button
 onClick={onAddVideo}
 title="Add YouTube Video"
 className="p-2.5 text-neutral-700 hover:text-flamingo hover:bg-flamingo/10 rounded-xl transition active:scale-95 group relative"
 >
 <Youtube className="w-5 h-5"/>
 <span className="hidden sm:group-hover:block absolute left-full ml-2 px-2 py-1 bg-neutral-900 text-white text-[11px] font-medium rounded shadow-lg whitespace-nowrap z-50">
 Add video
 </span>
 </button>

 <div className="w-full h-px sm:w-full bg-neutral-200 my-1 hidden sm:block"/>

 <button
 onClick={onAddSection}
 title="Add Section (Page Break)"
 className="p-2.5 text-neutral-700 hover:text-flamingo hover:bg-flamingo/10 rounded-xl transition active:scale-95 group relative"
 >
 <Split className="w-5 h-5"/>
 <span className="hidden sm:group-hover:block absolute left-full ml-2 px-2 py-1 bg-neutral-900 text-white text-[11px] font-medium rounded shadow-lg whitespace-nowrap z-50">
 Add section
 </span>
 </button>
 </div>
 );
};
