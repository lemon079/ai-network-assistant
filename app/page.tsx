import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Network, Zap, Shield, ArrowRight, Sparkles } from "lucide-react";

export default function LandingPage() {
    return (
        // Theme: Deep Dark Zinc (Shadcn Dark Mode Default)
        <div className="min-h-screen bg-zinc-950 text-zinc-50 selection:bg-zinc-800">

            {/* Background Grid: Adjusted to be visible on dark background (dark gray lines) */}
            <div className="absolute inset-0 -z-10 h-full w-full bg-[linear-gradient(to_right,#27272a_1px,transparent_1px),linear-gradient(to_bottom,#27272a_1px,transparent_1px)] bg-size-[6rem_4rem] mask-[radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"></div>

            {/* Hero Section */}
            <div className="container mx-auto px-4 py-24 md:py-32">
                <div className="text-center space-y-8 max-w-4xl mx-auto">

                    {/* Badge: Dark surface with subtle border */}
                    <div className="space-y-6">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 shadow-sm shadow-zinc-950">
                            <Sparkles className="size-3.5 text-zinc-400" />
                            <span className="text-sm text-zinc-300 font-medium">AI-Powered Network Management</span>
                        </div>

                        <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-white leading-[1.1]">
                            Your Network,
                            <br />
                            {/* Muted Gray span to match the monochromatic vibe */}
                            <span className="text-zinc-500">
                                Now Speaks AI
                            </span>
                        </h1>

                        <p className="text-xl text-zinc-400 max-w-2xl mx-auto font-light leading-relaxed">
                            Skip the tech jargon. Just tell your AI what you need, and watch it manage your network like magic.
                        </p>
                    </div>

                    {/* CTA Buttons */}
                    <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
                        <Link href="/setup">
                            {/* Primary Button: White bg, Black text (Matches your 'New Chat' button) */}
                            <Button size="lg" className="h-12 px-8 text-base bg-zinc-50 hover:bg-zinc-200 text-zinc-950 font-semibold rounded-md shadow-lg shadow-zinc-900/20 group">
                                Get Started
                                <ArrowRight className="ml-2 size-4 group-hover:translate-x-1 transition-transform" />
                            </Button>
                        </Link>
                        <Link href="/chat">
                            {/* Secondary Button: Dark bg, Border, White text */}
                            <Button size="lg" variant="outline" className="h-12 px-8 text-base bg-zinc-900 border-zinc-800 hover:bg-zinc-800 text-zinc-50 rounded-md">
                                Try Demo
                            </Button>
                        </Link>
                    </div>
                </div>

                {/* Features Grid */}
                <div className="grid md:grid-cols-3 gap-6 mt-24 max-w-5xl mx-auto">
                    <FeatureCard
                        icon={<Zap className="size-5" />}
                        title="Lightning Fast"
                        description="Instant responses to your network commands. No waiting, no hassle."
                    />
                    <FeatureCard
                        icon={<Network className="size-5" />}
                        title="Smart Management"
                        description="AI understands your intent. 'Show me who's hogging bandwidth' just works."
                    />
                    <FeatureCard
                        icon={<Shield className="size-5" />}
                        title="Secure Sessions"
                        description="Your router credentials stay safe. Sessions auto-renew intelligently."
                    />
                </div>

                {/* How it Works */}
                <div className="mt-32 max-w-3xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl font-bold tracking-tight text-white">How It Works</h2>
                        <p className="text-zinc-400 mt-2">Three simple steps to complete control.</p>
                    </div>

                    <div className="space-y-12">
                        <Step
                            number="1"
                            title="Connect Your Router"
                            description="One-time setup. We'll detect and connect to your router automatically."
                        />
                        <Step
                            number="2"
                            title="Ask in Plain English"
                            description="Type what you want: 'Block this device' or 'Show me network stats' - it just understands."
                        />
                        <Step
                            number="3"
                            title="Watch the Magic"
                            description="AI executes your request instantly. Real results, zero tech knowledge required."
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

// Sub-components adapted for Dark Mode

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
    return (
        // Matches the "Show my network information" cards from your screenshot
        <Card className="border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900 transition-colors">
            <CardHeader>
                <div className="size-10 rounded-md bg-zinc-950 border border-zinc-800 flex items-center justify-center mb-4 text-zinc-100">
                    {icon}
                </div>
                <CardTitle className="text-lg font-semibold text-zinc-100">{title}</CardTitle>
                <CardDescription className="text-zinc-400 leading-relaxed">
                    {description}
                </CardDescription>
            </CardHeader>
        </Card>
    )
}

function Step({ number, title, description }: { number: string, title: string, description: string }) {
    return (
        <div className="flex gap-6 items-start group">
            {/* Dark circle with light border */}
            <div className="size-10 rounded-full bg-zinc-950 border-2 border-zinc-800 group-hover:border-zinc-50 transition-colors flex items-center justify-center shrink-0 text-zinc-100 font-semibold shadow-sm">
                {number}
            </div>
            <div className="pt-1">
                <h3 className="text-lg font-semibold text-zinc-100 mb-2">{title}</h3>
                <p className="text-zinc-400 leading-relaxed">{description}</p>
            </div>
        </div>
    )
}