import { Link } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  FlaskConical,
  Leaf,
  ShieldCheck,
  Sparkles,
  Star,
} from "lucide-react";

import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";

export function HomePage() {
  return (
    <div className="min-h-screen flex flex-col font-sans text-gray-900 bg-[#FDFCF8]">
      <div className="absolute top-0 left-0 right-0 z-50">
        <Header />
      </div>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-[#FDFCF8] min-h-[85vh] flex items-center justify-center">
          {/* Organic Background Elements */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-[10%] left-[20%] w-[60vw] h-[60vw] bg-brand-100/30 rounded-full blur-[100px] mix-blend-multiply animate-pulse-slow"></div>
            <div className="absolute top-[20%] -right-[10%] w-[50vw] h-[50vw] bg-orange-50/50 rounded-full blur-[100px] mix-blend-multiply animate-float"></div>
            <div className="absolute bottom-[-10%] left-[-10%] w-[40vw] h-[40vw] bg-blue-50/40 rounded-full blur-[80px] mix-blend-multiply"></div>
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full py-12 md:py-20">
            <div className="max-w-5xl mx-auto text-center">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/80 border border-brand-100/50 backdrop-blur-md shadow-sm mb-10 animate-fade-in-up">
                <Sparkles className="w-3.5 h-3.5 text-brand-500 fill-brand-500" />
                <span className="text-xs font-bold text-brand-800 tracking-widest uppercase">
                  Science Meets Nature
                </span>
              </div>

              {/* Headline */}
              <h1 className="text-5xl sm:text-6xl lg:text-8xl font-bold tracking-tight text-gray-900 mb-8 leading-[1.1] drop-shadow-sm">
                <span className="block text-gray-900 mb-2">科学营养</span>
                <span className="block bg-clip-text text-transparent bg-gradient-to-r from-brand-600 via-brand-500 to-brand-400 pb-2">
                  纯净生活新体验
                </span>
              </h1>

              {/* Subheadline */}
              <p className="text-xl sm:text-2xl text-gray-600 mb-12 leading-relaxed max-w-2xl mx-auto font-light">
                我们致力于运用
                <span className="font-medium text-gray-900">前沿科学配方</span>
                ， 甄选
                <span className="font-medium text-gray-900">全球纯净原料</span>
                ，
                <br className="hidden sm:block" />
                为您提供高效、安全的营养解决方案。
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-5 justify-center">
                <Link
                  to="/landing/whey-protein"
                  className="group inline-flex items-center justify-center px-10 py-5 text-lg font-bold rounded-full text-white bg-gradient-to-r from-brand-600 to-brand-500 shadow-[0_8px_30px_-6px_rgba(147,191,70,0.5)] hover:shadow-[0_12px_40px_-6px_rgba(147,191,70,0.6)] transform hover:-translate-y-1 transition-all duration-300"
                >
                  探索明星产品
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Link>
                <a
                  href="#features"
                  className="inline-flex items-center justify-center px-10 py-5 text-lg font-bold rounded-full text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-900 shadow-sm hover:shadow-md transition-all duration-300"
                >
                  了解品牌理念
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section - Bento Grid Style */}
        <section id="features" className="py-24 bg-white relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-sm font-bold tracking-[0.2em] text-gray-400 uppercase mb-4">
                Why Choose Us
              </h2>
              <h3 className="text-4xl font-bold text-gray-900 mb-6">
                为了更好，我们坚持更多
              </h3>
              <div className="w-20 h-1.5 bg-brand-500 mx-auto rounded-full"></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Feature 1: Big Card (Special Formula) */}
              <div className="md:col-span-2 bg-[#F0F7FF] rounded-[2.5rem] p-10 relative overflow-hidden group hover:shadow-lg transition-all duration-500">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-100 rounded-full blur-[60px] -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-700"></div>
                <div className="relative z-10 flex flex-col h-full justify-between">
                  <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mb-6 shadow-sm">
                    <FlaskConical className="h-8 w-8 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-3">
                      专业科学配方
                    </h3>
                    <p className="text-gray-600 leading-relaxed text-lg max-w-md">
                      基于权威科学研究，精准把控每一个成分配比。拒绝概念性添加，确保每一份营养都能发挥真实功效。
                    </p>
                  </div>
                </div>
              </div>

              {/* Feature 2: Tall Card (Purity) */}
              <div className="md:row-span-2 bg-[#F2F9E9] rounded-[2.5rem] p-10 relative overflow-hidden group hover:shadow-lg transition-all duration-500 flex flex-col">
                <div className="absolute bottom-0 left-0 w-full h-1/2 bg-gradient-to-t from-green-100/50 to-transparent"></div>
                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mb-6 shadow-sm">
                  <Leaf className="h-8 w-8 text-brand-600" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">
                  纯净原料
                </h3>
                <p className="text-gray-600 leading-relaxed text-lg mb-8">
                  严选全球优质产地，从源头把控品质。拒绝不必要的添加剂，只留纯粹营养，回归自然本真。
                </p>
                <div className="mt-auto relative h-40">
                  {/* Decorative Elements pretending to be ingredients */}
                  <div className="absolute bottom-4 right-4 text-brand-200/40">
                    <Leaf className="w-32 h-32" />
                  </div>
                </div>
              </div>

              {/* Feature 3: Standard Card (Absorption) */}
              <div className="bg-[#FFF8F0] rounded-[2.5rem] p-10 group hover:shadow-lg transition-all duration-500">
                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mb-6 shadow-sm">
                  <CheckCircle2 className="h-8 w-8 text-orange-500" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">
                  高效吸收
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  采用先进工艺，大幅提升营养利用率，让身体真正受益，不浪费每一份精华。
                </p>
              </div>

              {/* Feature 4: Standard Card (Traceability) */}
              <div className="bg-[#F8F5FF] rounded-[2.5rem] p-10 group hover:shadow-lg transition-all duration-500">
                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mb-6 shadow-sm">
                  <ShieldCheck className="h-8 w-8 text-purple-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">
                  全程溯源
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  生产过程透明化，每一环节都严格把控，品质安全可追溯，让您吃得更放心。
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Product Showcase Section */}
        <section className="py-32 bg-[#F5F5F0] relative overflow-hidden">
          {/* Decorative blob */}
          <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-brand-100/40 rounded-full blur-[120px] -translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-4">
              <div>
                <h2 className="text-4xl font-bold text-gray-900 mb-4">
                  明星产品系列
                </h2>
                <p className="text-lg text-gray-500 font-light">
                  深受用户喜爱的健康精选，为不同需求定制
                </p>
              </div>
              <Link
                to="/landing/whey-protein"
                className="hidden md:inline-flex items-center text-brand-700 font-bold hover:text-brand-800 transition-colors group"
              >
                <span className="border-b-2 border-brand-200 group-hover:border-brand-500 transition-colors pb-1">
                  查看全部产品
                </span>
                <ArrowRight className="ml-2 h-5 w-5 transform group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Product 1: Whey Protein (Hero Product) */}
              <Link
                to="/landing/whey-protein"
                className="group relative bg-white rounded-[2.5rem] overflow-hidden shadow-sm hover:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.1)] transition-all duration-500 flex flex-col sm:flex-row h-full border border-gray-100"
              >
                <div className="absolute top-0 right-0 p-8 opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-20">
                  <div className="bg-brand-500 text-white text-xs font-bold px-3 py-1.5 rounded-full">
                    TOP 1
                  </div>
                </div>

                <div className="w-full sm:w-1/2 p-10 flex items-center justify-center bg-gradient-to-br from-gray-50 to-white group-hover:from-brand-50/50 group-hover:to-white transition-colors">
                  <img
                    src="https://xyht.oss-cn-hangzhou.aliyuncs.com/static/product/dbf/%E8%9B%8B%E7%99%BD%E7%B2%89%E5%8C%85%E8%A3%85%E6%A1%B6%E9%80%8F%E6%98%8E%E5%BA%95.png?x-oss-process=image/resize,w_800"
                    alt="分离乳清蛋白粉"
                    className="w-56 h-56 object-contain transform group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-700 drop-shadow-xl"
                  />
                </div>
                <div className="w-full sm:w-1/2 p-10 flex flex-col justify-center relative">
                  <div className="text-brand-600 text-xs font-bold tracking-widest uppercase mb-3">
                    Best Seller
                  </div>
                  <h3 className="text-3xl font-bold text-gray-900 mb-4 group-hover:text-brand-700 transition-colors">
                    分离乳清蛋白粉
                  </h3>
                  <p className="text-gray-500 mb-8 leading-relaxed">
                    92.3% 高纯度，0乳糖0脂肪。
                    <br />
                    快速吸收，健身塑形、日常补充的理想选择。
                  </p>
                  <span className="inline-flex items-center text-brand-600 font-bold group-hover:translate-x-2 transition-transform">
                    立即购买 <ArrowRight className="ml-2 h-5 w-5" />
                  </span>
                </div>
              </Link>

              {/* Product 2: Fiber (Available) */}
              <Link
                to="/landing/whey-protein"
                className="group relative bg-white rounded-[2.5rem] overflow-hidden shadow-sm hover:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.1)] transition-all duration-500 flex flex-col sm:flex-row h-full border border-gray-100"
              >
                <div className="absolute top-0 right-0 p-8 opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-20">
                  <div className="bg-orange-500 text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1">
                    <Star className="w-3 h-3 fill-current" /> NEW
                  </div>
                </div>

                <div className="w-full sm:w-1/2 p-10 flex items-center justify-center bg-gradient-to-br from-gray-50 to-white group-hover:from-orange-50/50 group-hover:to-white transition-colors">
                  <img
                    src="https://xyht.oss-cn-hangzhou.aliyuncs.com/static/product/dbf/%E8%86%B3%E5%B0%8F%E5%87%A1-%E6%B0%B4%E6%BA%B6%E6%80%A7%E8%86%B3%E9%A3%9F%E7%BA%A4%E7%BB%B4%E7%B2%89-%E5%A4%96%E5%8C%85%E8%A3%85%E6%95%88%E6%9E%9C%E5%9B%BE0514%E5%AE%9A%E6%9B%B2-02.png?x-oss-process=image/resize,w_800"
                    alt="水溶性膳食纤维粉"
                    className="w-56 h-56 object-contain transform group-hover:scale-110 group-hover:rotate-3 transition-transform duration-700 drop-shadow-xl"
                  />
                </div>
                <div className="w-full sm:w-1/2 p-10 flex flex-col justify-center">
                  <div className="text-orange-500 text-xs font-bold tracking-widest uppercase mb-3">
                    Gut Health
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-4 group-hover:text-orange-600 transition-colors">
                    水溶性膳食纤维粉
                  </h3>
                  <p className="text-gray-500 mb-8 leading-relaxed line-clamp-3">
                    精选 Fibersol-2
                    原料，促进肠道健康，维持血糖平稳。您的日常肠道管家，温和调理。
                  </p>
                  <span className="inline-flex items-center text-orange-500 font-bold group-hover:translate-x-2 transition-transform">
                    立即购买 <ArrowRight className="ml-2 h-5 w-5" />
                  </span>
                </div>
              </Link>
            </div>

            <div className="mt-12 text-center md:hidden">
              <Link
                to="/landing/whey-protein"
                className="inline-flex items-center text-brand-700 font-bold hover:text-brand-800 transition-colors"
              >
                查看全部产品 <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
