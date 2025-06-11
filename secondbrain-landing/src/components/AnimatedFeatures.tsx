'use client';

import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { MessageCircle, Users, Mic, Calendar, Brain, Sparkles, Star } from 'lucide-react';

const features = [
	{
		icon: MessageCircle,
		title: 'Chat Personal con IA',
		description: 'Conversa sobre tus pensamientos y obtén insights personalizados',
		color: 'from-purple-500 to-pink-500',
		accentColor: 'text-purple-400',
	},
	{
		icon: Users,
		title: 'Chat por Persona',
		description: 'Análisis individual de cada relación importante en tu vida',
		color: 'from-blue-500 to-cyan-500',
		accentColor: 'text-blue-400',
	},
	{
		icon: Mic,
		title: 'Grabación de Voz',
		description: 'Transcripción automática con IA que convierte voz en texto',
		color: 'from-green-500 to-emerald-500',
		accentColor: 'text-green-400',
	},
	{
		icon: Calendar,
		title: 'Navegación Temporal',
		description: 'Viaja a cualquier día de tu vida y revive tus memorias',
		color: 'from-indigo-500 to-purple-500',
		accentColor: 'text-indigo-400',
	},
];

export default function AnimatedFeatures() {
	const [activeFeature, setActiveFeature] = useState(0);

	useEffect(() => {
		const interval = setInterval(() => {
			setActiveFeature((prev) => (prev + 1) % features.length);
		}, 5000);
		return () => clearInterval(interval);
	}, []);

	return (
		<div className="w-full max-w-6xl mx-auto px-4">
			{/* Mobile and Tablet Layout */}
			<div className="lg:hidden">
				<div className="space-y-6">
					{features.map((feature, index) => (
						<motion.div
							key={index}
							initial={{ opacity: 0, y: 20 }}
							whileInView={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.6, delay: index * 0.1 }}
							className={`glass rounded-2xl p-6 transition-all duration-300 ${
								index === activeFeature
									? 'ring-2 ring-purple-500/50 bg-white/10'
									: 'hover:bg-white/5'
							}`}
							onClick={() => setActiveFeature(index)}
						>
							<div className="flex items-start space-x-4">
								<div
									className={`bg-gradient-to-r ${feature.color} w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0`}
								>
									<feature.icon className="w-6 h-6 text-white" />
								</div>
								<div className="flex-1">
									<h3 className="text-lg font-semibold text-white mb-2">
										{feature.title}
									</h3>
									<p className="text-gray-300 text-sm">
										{feature.description}
									</p>
								</div>
							</div>
						</motion.div>
					))}
				</div>
			</div>

			{/* Desktop Layout */}
			<div className="hidden lg:block">
				<div className="relative">
					{/* Central Brain Icon */}
					<motion.div
						className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20"
						animate={{
							scale: [1, 1.05, 1],
							rotate: [0, 2, -2, 0],
						}}
						transition={{
							duration: 4,
							repeat: Infinity,
							ease: 'easeInOut',
						}}
					>
						<div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full flex items-center justify-center shadow-2xl border-4 border-white/20">
							<Brain className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
							<div className="absolute -top-1 -right-1 w-6 h-6 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full flex items-center justify-center">
								<Sparkles className="w-3 h-3 text-white" />
							</div>
						</div>
					</motion.div>

					{/* Feature Cards in Circle */}
					<div className="relative w-96 h-96 mx-auto">
						{features.map((feature, index) => {
							const angle = (index * 360) / features.length;
							const isActive = index === activeFeature;

							return (
								<motion.div
									key={index}
									className="absolute cursor-pointer"
									style={{
										left: '50%',
										top: '50%',
										transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-160px) rotate(-${angle}deg)`,
									}}
									animate={{
										scale: isActive ? 1.1 : 1,
										opacity: isActive ? 1 : 0.7,
									}}
									whileHover={{
										scale: 1.2,
										opacity: 1,
									}}
									onClick={() => setActiveFeature(index)}
								>
									<motion.div
										className={`w-16 h-16 bg-gradient-to-r ${feature.color} rounded-xl flex items-center justify-center shadow-lg border-2 border-white/20`}
										animate={{
											boxShadow: isActive
												? '0 0 30px rgba(147, 51, 234, 0.6), 0 0 60px rgba(147, 51, 234, 0.3)'
												: '0 4px 20px rgba(0, 0, 0, 0.1)',
										}}
									>
										<feature.icon className="w-8 h-8 text-white" />
									</motion.div>
								</motion.div>
							);
						})}
					</div>

					{/* Connecting Lines - cover animationZone */}
					<svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
						{features.map((_, index) => {
							const angle = (index * 360) / features.length;
							const isActive = index === activeFeature;
							const x1 = 50; // %
							const y1 = 50; // %
							// Icons orbit at a radius of 160px. The animationZone (w-96) is 384px wide/high.
							// The line radius needs to be this 160px, expressed as a percentage of the SVG dimensions (384px).
							const lineRadiusPercentage = (160 / 384) * 100; // Approx 41.67%
							const x2 = 50 + lineRadiusPercentage * Math.sin((angle * Math.PI) / 180); // %
							const y2 = 50 - lineRadiusPercentage * Math.cos((angle * Math.PI) / 180); // %

							return (
								<motion.line
									key={index}
									x1={`${x1}%`}
									y1={`${y1}%`}
									x2={`${x2}%`}
									y2={`${y2}%`}
									stroke={isActive ? '#8b5cf6' : '#6b7280'}
									strokeWidth={isActive ? '3' : '1'}
									animate={{
										strokeOpacity: isActive ? 0.8 : 0.3,
									}}
									transition={{ duration: 0.3 }}
								/>
							);
						})}
					</svg>
				</div>

				{/* Active Feature Info */}
				<motion.div
					key={activeFeature}
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.5 }}
					className="text-center mt-12"
				>
					<div className="glass rounded-2xl p-8 max-w-2xl mx-auto">
						<div
							className={`inline-flex items-center mb-4 ${features[activeFeature].accentColor}`}
						>
							{(() => {
								const IconComponent = features[activeFeature].icon;
								return <IconComponent className="w-6 h-6 mr-2" />;
							})()}
							<Star className="w-4 h-4" />
						</div>
						<h3 className="text-2xl sm:text-3xl font-bold text-white mb-4">
							{features[activeFeature].title}
						</h3>
						<p className="text-gray-300 text-lg leading-relaxed">
							{features[activeFeature].description}
						</p>
					</div>
				</motion.div>
			</div>

			{/* Progress Indicator */}
			<div className="flex justify-center mt-8 space-x-2">
				{features.map((_, index) => (
					<motion.button
						key={index}
						className={`w-3 h-3 rounded-full transition-all duration-300 ${
							index === activeFeature
								? 'bg-gradient-to-r from-purple-500 to-pink-500'
								: 'bg-gray-600 hover:bg-gray-500'
						}`}
						animate={{
							scale: index === activeFeature ? 1.2 : 1,
						}}
						onClick={() => setActiveFeature(index)}
					/>
				))}
			</div>
		</div>
	);
}
