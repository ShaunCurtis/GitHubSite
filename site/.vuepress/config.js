const { description } = require('package')

const fs = require('fs');
const moment = require('moment');
const yamlFront = require('yaml-front-matter');
const path = require("path");
const glob = require('glob');

const sortDelimiter = ';';
const basePath = 'site';

let generalSidebar = [
  '/',
];

module.exports = {
  /**
   * Ref：https://v1.vuepress.vuejs.org/config/#title
   */
  title: 'Cold Elm Coders',
  /**
   * Ref：https://v1.vuepress.vuejs.org/config/#description
   */
  description: description,

  /**
   * Extra tags to be injected to the page HTML `<head>`
   *
   * ref：https://v1.vuepress.vuejs.org/config/#head
   */
  head: [
    ['meta', { name: 'theme-color', content: '#3eaf7c' }],
    ['meta', { name: 'apple-mobile-web-app-capable', content: 'yes' }],
    ['meta', { name: 'apple-mobile-web-app-status-bar-style', content: 'black' }]
  ],

  /**
   * Theme configuration, here is the default theme configuration for VuePress.
   *
   * ref：https://v1.vuepress.vuejs.org/theme/default-theme-config.html
   */
  themeConfig: {
    repo: '',
    editLinks: false,
    docsDir: '',
    editLinkText: '',
    lastUpdated: false,
    nav: [
      {
        text: 'Articles',
        link: '/articles/',
      },
      {
        text: 'Posts',
        link: '/posts/',
      },
      {
        text: 'Database Application',
        link: '/Building-a-Database-Application-in-Blazor/',
      },
      {
        text: 'Demo Site',
        link: 'https://cec-blazor-examples.azurewebsites.net/'
      }
    ],
    sidebar: { 
      '/articles/':getSideBar("articles", "My Articles"),
      '/posts/':getSideBar("posts", "My Posts"),
      '/Building-a-Database-Application-in-Blazor/':getSideBar("Building-a-Database-Application-in-Blazor", "Blazor Database Application"),
      '/' : [
        '',
        '/articles/',
        '/posts/',
        '/Building-a-Database-Application-in-Blazor/'
      ]
    },
    markdown: {
      lineNumbers: true
    }
  },

  /**
   * Apply plugins，ref：https://v1.vuepress.vuejs.org/zh/plugin/
   */
  plugins: [
    '@vuepress/plugin-back-to-top',
    '@vuepress/plugin-medium-zoom',
  ]
}

function getSideBar(folder, title) {
  const extension = [".md"];

  const files = fs
      .readdirSync(path.join(`${__dirname}/../${folder}`))
    .filter(
      (item) =>
        item.toLowerCase() != "readme.md" &&
        fs.statSync(path.join(`${__dirname}/../${folder}`, item)).isFile() &&
        extension.includes(path.extname(item))
    );

  return [{ title: title, children: ["", ...files] }];
}
