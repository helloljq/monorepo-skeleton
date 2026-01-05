/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
    forbidden: [
        {
            name: 'common-no-modules',
            comment: 'Code in common/ should not depend on feature modules (src/modules/)',
            severity: 'error',
            from: { path: '^src/common' },
            to: { path: '^src/modules' },
        },
        {
            name: 'no-circular',
            severity: 'warn',
            from: {},
            to: { circular: true },
        },
    ],
    options: {
        doNotFollow: {
            path: 'node_modules',
        },
        tsPreCompilationDeps: true,
        tsConfig: {
            fileName: 'tsconfig.json',
        },
    },
};
