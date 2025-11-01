type GradientBotProps = {
    size?: number; // px
    isStreaming?: boolean;
};

export default function GradientBot({ size = 28, isStreaming = false }: GradientBotProps) {
    const dim = `${size}px`;

    return (
        <>
            <div
                style={{
                    width: dim,
                    height: dim,
                    minWidth: dim,
                    minHeight: dim,
                    borderRadius: "50%",
                    aspectRatio: "1 / 1",
                    display: "inline-block",
                    flexShrink: 0,
                    background:
                        "linear-gradient(135deg, #1d4ed8, #3b82f6, #60a5fa, #93c5fd)",
                    backgroundSize: isStreaming ? "250% 250%" : "100% 100%",
                    animation: isStreaming ? "shiftGradient 2s ease-in-out infinite" : "none",
                }}
            />
            <style>
                {`
          @keyframes shiftGradient {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
        `}
            </style>
        </>
    );
}
