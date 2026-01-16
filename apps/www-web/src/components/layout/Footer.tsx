import { Link } from "react-router-dom";
import Logo from "@/assets/logo.svg";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-50 pt-16 pb-8 border-t border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          {/* Brand Info */}
          <div className="col-span-1 md:col-span-1">
            <img
              src={Logo}
              alt="Monorepo Skeleton"
              className="h-8 w-auto mb-4"
            />
            <p className="text-gray-500 text-sm leading-relaxed">
              专注于提供高品质营养补充剂，致力于让每个人都能享受纯净、高效的健康生活。
            </p>
          </div>

          {/* Quick Links */}
          <div className="col-span-1">
            <h3 className="text-sm font-semibold text-gray-900 tracking-wider uppercase mb-4">
              产品
            </h3>
            <ul className="space-y-3">
              <li>
                <Link
                  to="/landing/whey-protein"
                  className="text-gray-500 hover:text-brand-600 text-sm transition-colors"
                >
                  分离乳清蛋白粉
                </Link>
              </li>
              <li>
                <span className="text-gray-400 text-sm cursor-not-allowed">
                  膳食纤维粉 (Coming Soon)
                </span>
              </li>
            </ul>
          </div>

          <div className="col-span-1">
            <h3 className="text-sm font-semibold text-gray-900 tracking-wider uppercase mb-4">
              关于
            </h3>
            <ul className="space-y-3">
              <li>
                <Link
                  to="/about"
                  className="text-gray-500 hover:text-brand-600 text-sm transition-colors"
                >
                  品牌故事
                </Link>
              </li>
              <li>
                <Link
                  to="/about"
                  className="text-gray-500 hover:text-brand-600 text-sm transition-colors"
                >
                  联系我们
                </Link>
              </li>
            </ul>
          </div>

          <div className="col-span-1">
            <h3 className="text-sm font-semibold text-gray-900 tracking-wider uppercase mb-4">
              联系方式
            </h3>
            <ul className="space-y-3">
              <li className="text-sm text-gray-500">
                Email: support@monorepo-skeleton.test
              </li>
              <li className="text-sm text-gray-500">
                杭州Monorepo Skeleton科技有限公司
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-200 pt-8 flex flex-col md:flex-row justify-between items-center bg-gray-50">
          <p className="text-sm text-gray-400 mb-4 md:mb-0">
            © {currentYear} 杭州Monorepo Skeleton科技有限公司 版权所有
          </p>
          <div className="flex space-x-6">
            <a
              href="https://beian.miit.gov.cn"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-brand-600 text-sm transition-colors"
            >
              浙ICP备2025147018号-1
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
