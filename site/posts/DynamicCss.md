---
title: Blazor Dynamic Stylesheets
precis: How to change Stylesheets out at run time
date: 2020-10-01
---

# Dynamic Stylesheets

Some code snippets to change out CSS dynamically in Blazor.

Set up the default link in the page as:

```html
    <link id="dynamicCssLink" rel="stylesheet" href="/css/site.min.css" />
```

In this case the `elementId` is *dynamicCssLink*. 

JS code to go into site.js.
```js
window.DynamicCss = {
   setCss: function (elementId, url) {
        var link = document.getElementById(elementId);
        if (link === undefined) {
            link = document.createElement(elementId);
            link.id = elementId;
            document.head.insertBefore(link, document.head.firstChild);
            link.type = 'text/css';
            link.rel = 'stylesheet';
        }
        link.href = url;
        return true;
    }
}
```

Interop libary code.

```csharp
public class InterOpLibrary {
    protected IJSRuntime JSRuntime { get; }

    public InterOpLibrary(IJSRuntime jsRuntime)
    {
        JSRuntime = jsRuntime;
    }

    public ValueTask<bool> SetDynamicCss(string elementId, string url)
      => JSRuntime.InvokeAsync<bool>("DynamicCss.setCss", elementId, url);
}
```

[Source/Idea Material](https://github.com/chanan/BlazorStrap) 
