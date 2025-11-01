import { RefObject } from "react";
import Composer from "./Composer";

type WelcomeProps = {
  input: string;
  setInput: (v: string) => void;
  sending: boolean;
  onSend: () => void;
  onStop?: () => void;
  inputRef: RefObject<HTMLInputElement>;
  models?: { id: string; name?: string; downloaded?: boolean; provider?: string; size_gb?: number }[];
  model?: string;
  setModel?: (id: string) => void;
  setModels?: React.Dispatch<React.SetStateAction<{ id: string; name?: string; downloaded?: boolean; provider?: string; size_gb?: number }[]>>;
};

export default function Welcome({ input, setInput, sending, onSend, onStop, inputRef, models, model, setModel, setModels }: WelcomeProps) {
  return (
    <div className="max-w-3xl mx-auto px-6 min-h-[70vh] flex flex-col text-center flex justify-center items-center h-screen">
      <div className="mb-4 text-3xl sm:text-4xl font-serif font-thin">Ask a Question</div>
      <div className="w-full pt-6">
        <Composer input={input} setInput={setInput} sending={sending} onSend={onSend} onStop={onStop} inputRef={inputRef} placeholder="How can I help you today?" models={models} model={model} setModel={setModel} setModels={setModels} />
      </div>
    </div>
  );
}



