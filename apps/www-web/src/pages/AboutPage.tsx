import { Heart, Shield, Sun } from "lucide-react";

import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";

export function AboutPage() {
  return (
    <div className="min-h-screen font-sans text-gray-900 bg-white flex flex-col">
      <Header />

      <main className="flex-1 pt-16">
        {/* Hero Section */}
        <section className="bg-brand-50 py-20 text-center">
          <div className="max-w-4xl mx-auto px-4">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              关于Monorepo Skeleton
            </h1>
            <p className="text-xl text-gray-600 leading-relaxed max-w-2xl mx-auto">
              我们要做的不仅仅是生产营养品，更是传递一种健康、积极、纯净的生活方式。
            </p>
          </div>
        </section>

        {/* Story Section */}
        <section className="py-16 bg-white">
          <div className="max-w-3xl mx-auto px-4">
            <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
              品牌故事
            </h2>
            <div className="prose prose-lg mx-auto text-gray-600">
              <p className="mb-6">
                Monorepo
                Skeleton成立于杭州，诞生于对“纯净营养”的执着追求。在这个充斥着过度加工和添加剂的时代，我们经常问自己：**能不能做一款自己和家人都敢放心吃的营养品？**
              </p>
              <p className="mb-6">
                于是，我们走遍全球，寻找最纯净的原料产地。从新西兰的天然牧场，到领先的低温萃取实验室，也就是为了保留那一份来自大自然的馈赠。
              </p>
              <p>
                “笑悦”代表着身心愉悦。我们相信，只有身体健康轻盈，内心才能真正感到快乐。我们希望通过科学、纯净的营养补充，帮助每一位用户找回身体的最佳状态，享受生活中的每一个微笑时刻。
              </p>
            </div>
          </div>
        </section>

        {/* Values Section */}
        <section className="py-16 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-gray-900">
                我们的核心价值观
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
              <div className="bg-white p-8 rounded-2xl shadow-sm">
                <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Heart className="h-8 w-8 text-red-500" />
                </div>
                <h3 className="text-xl font-bold mb-3">用户至上</h3>
                <p className="text-gray-600">
                  一切产品研发都源于用户的真实需求，做即食懂你的营养伴侣。
                </p>
              </div>
              <div className="bg-white p-8 rounded-2xl shadow-sm">
                <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Shield className="h-8 w-8 text-green-500" />
                </div>
                <h3 className="text-xl font-bold mb-3">纯净安全</h3>
                <p className="text-gray-600">
                  坚持“0添加”理念，严格把控原料与生产，只提供安全可靠的营养。
                </p>
              </div>
              <div className="bg-white p-8 rounded-2xl shadow-sm">
                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Sun className="h-8 w-8 text-blue-500" />
                </div>
                <h3 className="text-xl font-bold mb-3">科学高效</h3>
                <p className="text-gray-600">
                  依托科学配方与先进工艺，让每一份营养都能被身体高效吸收。
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
