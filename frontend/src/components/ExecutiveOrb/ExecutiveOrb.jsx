import ExecutiveOrbCanvas from "./ExecutiveOrbCanvas";
import { Mic } from "lucide-react";

export default function ExecutiveOrb({ state }) {
    return (
        <div className="flex flex-col items-center gap-6">

            {/* ESFERA */}
            <div className="relative">

                {/* Glow exterior */}
                <div className="absolute inset-0 blur-3xl bg-blue-500/20 rounded-full" />

                <ExecutiveOrbCanvas state={state} />

            </div>

            {/* TEXTO */}
            <div className="text-center space-y-2">
                <p className="text-sm text-gray-400">
                    Executive Mode
                </p>

                <p className="text-white text-lg font-medium">
                    {state === "listening" && "Escuchando..."}
                    {state === "processing" && "Pensando..."}
                    {state === "speaking" && "Respondiendo..."}
                    {state === "idle" && "¿Qué necesitas organizar hoy?"}
                </p>
            </div>

            {/* BOTÓN */}
            <button className="lucy-button w-14 h-14 rounded-full flex items-center justify-center">
                <Mic size={20} />
            </button>
        </div>
    );
}