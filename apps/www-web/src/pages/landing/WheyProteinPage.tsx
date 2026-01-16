import { useState } from "react";
import {
  Check,
  Copy,
  UserPlus,
  Mountain,
  MessageCircle,
  Gem,
  Activity,
  Leaf,
} from "lucide-react";
import FeatureAbsorption from "@/assets/images/feature-absorption.png";
import FeaturePasture from "@/assets/images/feature-pasture.png";
import FeaturePurity from "@/assets/images/feature-purity.png";
import UseCaseBreakfast from "@/assets/images/usecase-breakfast.png";
import UseCaseGym from "@/assets/images/usecase-gym.png";
import UseCaseOffice from "@/assets/images/usecase-office.png";
import { Modal } from "@/components/Modal";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";

export function WheyProteinPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      alert("复制失败，请手动复制: " + text);
    }
  };

  return (
    <div className="min-h-screen font-sans text-gray-900 bg-[#FDFCF8] flex flex-col">
      <div className="absolute top-0 left-0 right-0 z-50">
        <Header />
      </div>

      <main className="flex-1">
        {/* Hero Section */}
        {/* Hero Section - Redesigned for Premium Softness */}
        <section className="relative pt-16 pb-16 sm:pt-40 sm:pb-32 overflow-hidden bg-[#FDFCF8]">
          {/* Organic Background Elements - Living & Breathing */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-[20%] -left-[10%] w-[70vw] h-[70vw] bg-brand-100/30 rounded-full blur-[80px] sm:blur-[120px] mix-blend-multiply animate-pulse-slow"></div>
            <div className="absolute top-[10%] -right-[10%] w-[60vw] h-[60vw] bg-orange-50/40 rounded-full blur-[80px] sm:blur-[120px] mix-blend-multiply animate-float"></div>
            <div className="absolute -bottom-[20%] left-[20%] w-[50vw] h-[50vw] bg-white/60 rounded-full blur-[60px] mix-blend-overlay"></div>
          </div>

          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center gap-8 md:gap-12">
            {/* Left Column: Content */}
            <div className="w-full md:w-1/2 flex flex-col items-center md:items-start text-center md:text-left order-2 md:order-1 relative">
              {/* Premium Top Label */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/60 border border-brand-100/50 backdrop-blur-sm shadow-sm mb-6 animate-fade-in-up">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-500"></span>
                <span className="text-[10px] sm:text-xs font-semibold text-brand-800 tracking-widest uppercase">
                  Nature's Purest Source
                </span>
              </div>

              {/* Headline */}
              <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold text-gray-900 tracking-tight leading-[1.1] mb-6 drop-shadow-sm">
                <span className="block text-brand-800">纯净滋养</span>
                <span className="block bg-clip-text text-transparent bg-gradient-to-r from-gray-900 via-gray-800 to-gray-600">
                  唤醒身体轻盈力
                </span>
              </h1>

              {/* Subtitle */}
              <p className="text-base sm:text-xl text-gray-600 leading-relaxed mb-8 max-w-lg md:max-w-none mx-auto md:mx-0 font-light">
                专为女性定制的{" "}
                <span className="font-medium text-brand-700">92.3% 高纯度</span>{" "}
                分离乳清蛋白。
                <br className="hidden sm:inline" />
                剔除多余负担，只留纯粹营养，每一口都是对身体的温柔呵护。
              </p>

              {/* Premium Badges Row */}
              <div className="flex flex-wrap justify-center md:justify-start gap-3 sm:gap-4 mb-10 w-full">
                {[
                  { label: "新西兰草饲奶源", icon: "Mountain" },
                  { label: "0蔗糖 0腹胀", icon: "Leaf" },
                  { label: "小分子快吸收", icon: "Activity" },
                ].map((badge, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 px-3 py-2 bg-white/80 rounded-xl shadow-sm border border-gray-100/50"
                  >
                    {badge.icon === "Mountain" && (
                      <Mountain className="w-4 h-4 text-brand-500" />
                    )}
                    {badge.icon === "Leaf" && (
                      <Leaf className="w-4 h-4 text-brand-500" />
                    )}
                    {badge.icon === "Activity" && (
                      <Activity className="w-4 h-4 text-brand-500" />
                    )}
                    <span className="text-xs sm:text-sm font-medium text-gray-700">
                      {badge.label}
                    </span>
                  </div>
                ))}
              </div>

              {/* CTA Group */}
              <div className="flex flex-col sm:flex-row items-center gap-6 w-full sm:w-auto">
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="group relative w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r from-brand-600 to-brand-500 text-white text-lg font-medium rounded-full shadow-[0_8px_20px_-4px_rgba(147,191,70,0.4)] hover:shadow-[0_12px_24px_-6px_rgba(147,191,70,0.5)] transform hover:-translate-y-0.5 transition-all duration-300"
                >
                  <MessageCircle className="mr-2 h-5 w-5 animate-bounce-slow" />
                  <span>跟笑姐一起打卡</span>
                  <div className="absolute inset-0 rounded-full ring-2 ring-white/20 group-hover:ring-white/40 transition-all"></div>
                </button>

                <div className="flex items-center gap-3 opacity-90">
                  <div className="flex -space-x-2">
                    {[1, 2, 3].map((n) => (
                      <div
                        key={n}
                        className="w-8 h-8 rounded-full border-2 border-white bg-gray-200 overflow-hidden"
                      >
                        <img
                          src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${n + 20}`}
                          alt="user"
                        />
                      </div>
                    ))}
                  </div>
                  <span className="text-xs text-gray-500 font-medium">
                    1000+ 姐妹已加入
                  </span>
                </div>
              </div>
            </div>

            {/* Right Column: Visual Anchor */}
            <div className="w-full md:w-1/2 flex justify-center items-center relative order-1 md:order-2 mb-8 md:mb-0">
              {/* Product Glow */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-brand-200/40 rounded-full blur-[60px]"></div>

              <img
                src="https://xyht.oss-cn-hangzhou.aliyuncs.com/static/product/dbf/%E8%9B%8B%E7%99%BD%E7%B2%89%E5%8C%85%E8%A3%85%E6%A1%B6%E9%80%8F%E6%98%8E%E5%BA%95.png?x-oss-process=image/resize,w_800"
                alt="Premium Whey Protein"
                className="relative z-10 w-auto h-[320px] sm:h-[450px] object-contain drop-shadow-2xl animate-float"
              />

              {/* Floating Tag - Visual Interest */}
              <div className="absolute bottom-10 right-0 sm:right-10 bg-white/90 backdrop-blur-md px-4 py-3 rounded-2xl shadow-lg border border-white/50 animate-float-delayed hidden sm:flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center text-orange-500">
                  <Gem className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                    Purity
                  </p>
                  <p className="text-sm font-bold text-gray-800">92.3% 纯度</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* The 4-Zero Commitment (Typographic Clean List) */}
        <section className="py-24 bg-[#F5F5F0]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-sm font-bold tracking-[0.3em] text-gray-400 uppercase mb-4">
              The Clean List
            </h2>
            <h3 className="text-3xl sm:text-5xl font-serif font-medium text-gray-900 mb-16">
              坚持“四零”承诺
              <span className="block text-lg sm:text-xl text-gray-500 font-sans font-light mt-4">
                拒绝不必要的添加，只给身体最纯粹的
              </span>
            </h3>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-gray-200 border border-gray-200">
              {[
                { label: "Sugars", cn: "蔗糖", desc: "0g Added" },
                { label: "Fillers", cn: "添加剂", desc: "None" },
                { label: "Artificial", cn: "人工香精", desc: "0%" },
                { label: "Soy", cn: "大豆蛋白", desc: "Free" },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="bg-[#F5F5F0] p-8 md:p-12 hover:bg-white transition-colors duration-500 group"
                >
                  <div className="text-6xl font-serif text-gray-200 group-hover:text-brand-200 transition-colors mb-4">
                    0
                  </div>
                  <div className="text-xs font-bold tracking-widest uppercase text-gray-400 mb-1">
                    {item.label}
                  </div>
                  <div className="text-xl font-bold text-gray-900 mb-2">
                    {item.cn}
                  </div>
                  <div className="text-sm text-brand-600 font-medium">
                    {item.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Immersive Visual Features (Poster Style) */}

        {/* Section 1: Source (Parallax Background) */}
        <section className="relative min-h-[600px] flex items-center justify-center py-20 overflow-hidden bg-gray-900 group">
          {/* Background Image */}
          <div
            className="absolute inset-0 z-0 bg-cover bg-center transition-transform duration-[2s] group-hover:scale-105"
            style={{ backgroundImage: `url(${FeaturePasture})` }}
          >
            <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px]"></div>
          </div>

          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex justify-end">
            {/* Glass Card */}
            <div className="bg-white/90 backdrop-blur-md p-8 md:p-12 rounded-[2rem] max-w-lg shadow-2xl border border-white/40 animate-fade-in-up">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 border border-brand-100 mb-6">
                <Mountain className="w-4 h-4 text-brand-600" />
                <span className="text-xs font-bold text-brand-700 tracking-wider">
                  NEW ZEALAND
                </span>
              </div>
              <h3 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-6 leading-tight">
                纯净奶源的
                <br />
                <span className="text-brand-600">自然馈赠</span>
              </h3>
              <p className="text-lg text-gray-600 leading-relaxed mb-8">
                甄选新西兰黄金奶源带，这里空气纯净、水源清澈。
                每一只奶牛都享受着全年 2000
                小时以上的阳光浴，天然草饲，自然生长。
              </p>

              <div className="grid grid-cols-2 gap-6 pt-6 border-t border-gray-100">
                <div>
                  <span className="block text-2xl font-bold text-gray-900 text-brand-700">
                    100%
                  </span>
                  <span className="text-xs text-gray-500 font-medium">
                    Grass Fed
                  </span>
                </div>
                <div>
                  <span className="block text-2xl font-bold text-gray-900 text-brand-700">
                    0
                  </span>
                  <span className="text-xs text-gray-500 font-medium">
                    Hormones
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Purity (Clean White Space with Texture) */}
        <section className="relative py-24 bg-[#F8F9FA] overflow-hidden">
          {/* Background Texture */}
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2/3 max-w-[800px] opacity-100 mix-blend-multiply pointer-events-none translate-x-1/4">
            <img src={FeaturePurity} alt="" className="w-full object-contain" />
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="w-full md:w-1/2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-100 border border-purple-200 mb-6">
                <Gem className="w-4 h-4 text-purple-600" />
                <span className="text-xs font-bold text-purple-700 tracking-wider">
                  PURITY
                </span>
              </div>
              <h3 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-8 leading-tight tracking-tight">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-gray-600">
                  92.3%
                </span>
                <br />
                高纯蛋白
              </h3>
              <p className="text-xl text-gray-600 leading-relaxed mb-10 font-light">
                采用先进的 <strong>离子交换 (Ion Exchange)</strong> 工艺，
                定向分离多余成分，只保留高纯度的分离乳清蛋白，每一勺都是身体渴望的纯净营养。
              </p>
              <ul className="space-y-4">
                {[
                  "高纯度 0 脂肪，保持身材无负担",
                  "去除 99% 乳糖，乳糖不耐受友好",
                  "富含支链氨基酸，唤醒身体代谢力",
                ].map((item, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-4 text-gray-700 text-lg"
                  >
                    <div className="w-6 h-6 rounded-full bg-brand-100 flex items-center justify-center shadow-sm">
                      <Check className="w-3.5 h-3.5 text-brand-600" />
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Section 3: Absorption (Immersive Rich Protein Flow) */}
        <section className="relative min-h-[600px] flex items-center py-20 overflow-hidden bg-amber-50">
          {/* Background Image */}
          <div
            className="absolute inset-0 z-0 bg-cover bg-center opacity-90"
            style={{ backgroundImage: `url(${FeatureAbsorption})` }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-white/95 via-white/60 to-transparent"></div>
          </div>

          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
            <div className="max-w-lg">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 border border-amber-200/50 backdrop-blur shadow-sm mb-6">
                <Activity className="w-4 h-4 text-amber-700" />
                <span className="text-xs font-bold text-amber-800 tracking-wider">
                  FAST ABSORPTION
                </span>
              </div>
              <h3 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-8 leading-tight">
                快速充能
                <br />
                <span className="text-amber-600">深层滋养</span>
              </h3>
              <p className="text-lg text-gray-700 leading-relaxed mb-8">
                得益于 <strong>离子交换</strong> 技术的高纯度特性， 富含{" "}
                <strong>亮氨酸 (Leucine)</strong> 与支链氨基酸，
                无需复杂消化，迅速唤醒身体能量。
              </p>

              <div className="p-6 bg-white/40 backdrop-blur-md rounded-2xl border border-white/60 shadow-lg">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 font-bold text-xl">
                    ⚡
                  </div>
                  <div>
                    <div className="text-sm text-gray-500 font-medium">
                      运动后修复黄金窗
                    </div>
                    <div className="text-xl font-bold text-gray-900">
                      30分钟快速吸收
                    </div>
                  </div>
                </div>
                <p className="text-sm text-gray-600 border-t border-amber-100/50 pt-4">
                  *这是肌肉合成与恢复的关键时机，高纯度 WPI
                  提供即时营养支持，拒绝身体异化分解。
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Use Cases (Lifestyle Gallery) */}
        <section className="py-24 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-12 text-center">
            <h2 className="text-3xl font-bold text-gray-900">
              随时随地，补充能量
            </h2>
          </div>

          <div className="flex flex-col md:flex-row h-auto md:h-[600px] w-full">
            {[
              {
                title: "活力早餐",
                desc: "搭配牛奶或燕麦，开启元气满满的一天",
                image: UseCaseBreakfast,
              },
              {
                title: "运动修复",
                desc: "运动后 30 分钟，快速为肌肉补充营养",
                image: UseCaseGym,
              },
              {
                title: "日常加餐",
                desc: "办公间隙，随时补充，健康无负担",
                image: UseCaseOffice,
              },
            ].map((item, idx) => (
              <div
                key={idx}
                className="relative flex-1 group overflow-hidden min-h-[300px] md:min-h-0"
              >
                <div
                  className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
                  style={{ backgroundImage: `url(${item.image})` }}
                ></div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-80 group-hover:opacity-90 transition-opacity"></div>

                <div className="absolute bottom-0 left-0 p-8 md:p-10 transform transition-transform duration-500 md:translate-y-4 group-hover:translate-y-0 text-left">
                  <h3 className="text-2xl font-bold text-white mb-2">
                    {item.title}
                  </h3>
                  <p className="text-white/80 text-sm md:text-base leading-relaxed opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-100">
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Bottom CTA - Standard Layout (Desktop/Pad) */}
        <section className="bg-gradient-to-br from-brand-600 to-brand-700 py-16 text-center relative overflow-hidden">
          {/* Decorative Background Circles */}
          <div className="absolute top-0 left-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
          <div className="absolute bottom-0 right-0 w-64 h-64 bg-brand-400/20 rounded-full blur-3xl translate-x-1/2 translate-y-1/2"></div>

          <div className="max-w-4xl mx-auto px-4 relative z-10">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6 tracking-tight">
              准备好开启健康生活了吗？
            </h2>
            <p className="text-brand-50 text-lg mb-10 max-w-2xl mx-auto">
              加入我们的社群，与 1000+ 姐妹一起变美变瘦。
              <br className="hidden sm:inline" />
              获取更多专业营养建议和专属福利。
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center px-10 py-4 bg-white text-brand-700 rounded-full font-bold text-xl hover:bg-gray-50 transition-colors shadow-2xl hover:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.2)] transform hover:-translate-y-0.5"
            >
              <UserPlus className="mr-2 h-6 w-6" />
              添加小助理进群
            </button>
          </div>
        </section>
      </main>

      {/* Sticky Bottom Bar (Mobile Only) */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-lg border-t border-gray-200 z-50 sm:hidden flex items-center justify-between gap-4 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        <div className="flex flex-col">
          <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">
            Join Now
          </span>
          <span className="text-brand-700 font-bold text-lg">跟笑姐打卡</span>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex-1 max-w-[200px] h-11 bg-brand-600 text-white rounded-full font-bold text-sm shadow-lg flex items-center justify-center active:scale-95 transition-transform"
        >
          立即加入
        </button>
      </div>

      <Footer />

      {/* WeChat Modal - Preserving Logic */}
      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="跟笑姐一起打卡"
      >
        <div className="space-y-6">
          <div className="bg-gray-50 p-4 rounded-xl text-center">
            <p className="text-gray-600 mb-3 text-sm">点击下方按钮复制微信号</p>
            <button
              onClick={() => handleCopy("xiaojiexzl")}
              className="inline-flex items-center justify-center px-4 py-2 bg-brand-100 text-brand-700 rounded-lg font-mono font-bold text-lg hover:bg-brand-200 transition-colors w-full border border-brand-200"
            >
              xiaojiexzl
              <Copy className="ml-2 h-4 w-4" />
            </button>
            {copySuccess && (
              <p className="text-green-600 text-sm mt-2 font-medium flex items-center justify-center">
                <Check className="w-4 h-4 mr-1" /> 已复制，请去微信搜索添加
              </p>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex items-start p-3 bg-brand-50 rounded-lg border border-brand-100">
              <div className="flex-shrink-0 mt-0.5 w-6 h-6 bg-brand-200 rounded-full flex items-center justify-center text-brand-700 font-bold text-xs">
                1
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-900">
                  点击上方按钮复制微信号
                </p>
                <p className="text-xs text-gray-500 mt-0.5">一定要先复制哦</p>
              </div>
            </div>

            <div className="flex items-start p-3 bg-brand-50 rounded-lg border border-brand-100">
              <div className="flex-shrink-0 mt-0.5 w-6 h-6 bg-brand-200 rounded-full flex items-center justify-center text-brand-700 font-bold text-xs">
                2
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-900">
                  打开微信 "添加朋友"
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  点击微信首页右上角 ⊕ ➝ 选择 "添加朋友"
                </p>
              </div>
            </div>

            <div className="flex items-start p-3 bg-brand-50 rounded-lg border border-brand-100">
              <div className="flex-shrink-0 mt-0.5 w-6 h-6 bg-brand-200 rounded-full flex items-center justify-center text-brand-700 font-bold text-xs">
                3
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-900">粘贴并搜索</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  在搜索框粘贴微信号，点击搜索即可
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-center text-gray-400">
              添加时请备注“官网”，以便小助理更快通过哦
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
