---
title: Chapter 6 - Rebuilding FetchData
oneliner: Rebuilding FetchData
precis: Rebuilding FetchData
date: 2021-08-13
published: 2021-08-13
---

# A Blazor Database Primer - Rebuilding FetchData

This chapter focuses on rebuilding the FetchData page.  Thwe original page looks like this:

```csharp
@page "/fetchdata"

@using WeatherTesting.Data
@inject WeatherForecastService ForecastService

<h1>Weather forecast</h1>

<p>This component demonstrates fetching data from a service.</p>

@if (forecasts == null)
{
    <p><em>Loading...</em></p>
}
else
{
    <table class="table">
        <thead>
            <tr>
                <th>Date</th>
                <th>Temp. (C)</th>
                <th>Temp. (F)</th>
                <th>Summary</th>
            </tr>
        </thead>
        <tbody>
            @foreach (var forecast in forecasts)
            {
                <tr>
                    <td>@forecast.Date.ToShortDateString()</td>
                    <td>@forecast.TemperatureC</td>
                    <td>@forecast.TemperatureF</td>
                    <td>@forecast.Summary</td>
                </tr>
            }
        </tbody>
    </table>
}

@code {
    private WeatherForecast[] forecasts;

    protected override async Task OnInitializedAsync()
    {
        forecasts = await ForecastService.GetForecastAsync(DateTime.Now);
    }
}
```

Why change it?

1. There's no separation of concerns.  The component both gets, manages and holds the data and displays it.
2. We're mixing high level functionality - this is a RouteView - with the nitty gritty of building raw Html.
3. How do we embed this as a form into another page?

Our goal is a "page" that looks like this:

```html
@page "/WeatherForecasts"

<WeatherForecastListForm/>
```
It's a single form.  `WeatherForecastListForm` looks like this:

```html
@namespace BlazorDB.UI.Forms

<UIListControl TRecord="WeatherForecast" Records="this.ViewService.Records" IsLoaded="this.ViewService.HasRecords" class="table">
    <RowTemplate>
        <UIListColumn HeaderTitle="Date">@context.Date.ToShortDateString()</UIListColumn>
        <UIListColumn HeaderTitle="Temp &deg; C">@context.TemperatureC</UIListColumn>
        <UIListColumn HeaderTitle="Temp &deg; F">@context.TemperatureF</UIListColumn>
        <UIListColumn HeaderTitle="Summary">@context.Summary</UIListColumn>
        <UIListColumn HeaderTitle="Detail">@context.Name</UIListColumn>
    </RowTemplate>
</UIListControl>
```
```csharp
@code {
    [Inject] BlazorDB.Core.WeatherForecastViewService ViewService { get; set; }

    protected override async Task OnInitializedAsync()
    {
        await ViewService.GetRecordsAsync();
    }
}
```

## Nomenclature

The word "Page" creates serious confusion word in Blazor and all SPA frameworks.  It's used to describe different things in different contexts.  Look at the code above - `@page "/fetchdata"
`.  Is `FetchData` really a web page?  In my book, no.  There's only one (Web) Page in a SPA - the startup page.  From then on the SPA changes out and manipulates the DOM in that page.  The browser doesn't reload anything.

Throughout this set of articles the following nomenclature is used:
1. **Page** is a web page that the browser loads.  There's one page per SPA.
2. **RouteView** is the component that gets loaded when the "route" changes.  `RouteView` is the name of the component that's responsible in `App` for changing out the component associated with a specific route. `Index`, `Counter`, `FetchData` are RouteViews.
3. **Form** is a high level component that does a "unit of work" - display a list of records, edit a record, enter out user information.  Forms are built from controls, not markup.  The WeatherForecast list is a form.
4. **Control** is a low level component that builds out the html markup.  Controls can contains controls.  A row component in the WeatherForecast list is a control.

## Blazr.Primer.UI

### Imports

Update `Imports.razor
```
@using System.Net.Http
@using Microsoft.AspNetCore.Authorization
@using Microsoft.AspNetCore.Components.Forms
@using Microsoft.AspNetCore.Components.Routing
@using Microsoft.AspNetCore.Components.Web
@using Microsoft.AspNetCore.Components.Web.Virtualization
@using Microsoft.JSInterop
@using Blazr.Primer.UI.Components
@using Blazr.Primer.Core
@using Blazr.Primer.UI.Components
@using Blazr.Primer.UI.Forms
```

### Base Controls and Utilities

We need a base UI class to implement some common functionality:

```csharp
using Microsoft.AspNetCore.Components;
using System.Collections.Generic;
using System.Linq;

namespace Blazr.Primer.UI.Components
{
    public abstract class UIComponentBase : ComponentBase
    {
        [Parameter] public bool Show { get; set; } = true;
        [Parameter] public RenderFragment ChildContent { get; set; }
        [Parameter(CaptureUnmatchedValues = true)] public IDictionary<string, object> UserAttributes { get; set; } = new Dictionary<string, object>();
        protected virtual List<string> UnwantedAttributes { get; set; } = new List<string>();

        protected Dictionary<string, object> SplatterAttributes
        {
            get
            {
                var list = new Dictionary<string, object>();
                foreach (var item in UserAttributes)
                {
                    if (!UnwantedAttributes.Any(item1 => item1.Equals(item.Key)))
                        list.Add(item.Key, item.Value);
                }
                return list;
            }
        }
    }
}
```

1. `Show` can be used to show or hide the components in markup.
2. `ChildContent` is the content betwween the opening and closing tags for the component. In `<MyComponent><span>Hello</span></MyComponent>`, `<span>Hello</span>` is the ChildContent.
3. `UserAttributes` are all the attributes added to the component that are not `Parameters`. In `<MyComponent class="my-class"><span>Hello</span></MyComponent>`, `class="my-class"` is an unmatched attribute.
4. `UnwantedAttributes` lets you define a list of attributes you want to remove from the attribute list.  If you define your own `class` and want to discard any `class` component specified `class`, add `class` to the `UnwantedAttributes` list.
5. `SplatterAttributes` are the `UserAttributes` minus the `UnwantedAttributes`.  We'll see it in use later.

#### CSSBuilder

A common task in a UI component is building the Css class.

`CSSBuilder` uses the builder pattern to collect and then output a class string.

```csharp
// File: Blazr.Primer.UI.Components/Component/Base/CSSBuilder.cs
using System.Collections.Generic;
using System.Text;
using System.Linq;

namespace Blazr.Primer.UI.Components
{
    public class CSSBuilder
    {
        private Queue<string> _cssQueue = new Queue<string>();

        public static CSSBuilder Class(string cssFragment = null)
        {
            var builder = new CSSBuilder(cssFragment);
            return builder.AddClass(cssFragment);
        }

        public CSSBuilder(string cssFragment)
            => AddClass(cssFragment);

        public CSSBuilder AddClass(string cssFragment)
        {
            if (!string.IsNullOrWhiteSpace(cssFragment)) _cssQueue.Enqueue(cssFragment);
            return this;
        }

        public CSSBuilder AddClass(IEnumerable<string> cssFragments)
        {
            if (cssFragments != null)
                cssFragments.ToList().ForEach(item => _cssQueue.Enqueue(item));
            return this;
        }

        public CSSBuilder AddClass(string cssFragment, bool WhenTrue)
            => WhenTrue ? this.AddClass(cssFragment) : this;

        public CSSBuilder AddClass(string trueCssFragment, string falseCssFragment, bool WhenTrue)
            => WhenTrue ? this.AddClass(trueCssFragment) : this.AddClass(falseCssFragment);

        public CSSBuilder AddClassFromAttributes(IReadOnlyDictionary<string, object> additionalAttributes)
        {
            if (additionalAttributes != null && additionalAttributes.TryGetValue("class", out var val))
                _cssQueue.Enqueue(val.ToString());
            return this;
        }

        public CSSBuilder AddClassFromAttributes(IDictionary<string, object> additionalAttributes)
        {
            if (additionalAttributes != null && additionalAttributes.TryGetValue("class", out var val))
                _cssQueue.Enqueue(val.ToString());
            return this;
        }

        public string Build(string CssFragment = null)
        {
            if (!string.IsNullOrWhiteSpace(CssFragment)) _cssQueue.Enqueue(CssFragment);
            if (_cssQueue.Count == 0)
                return string.Empty;
            var sb = new StringBuilder();
            foreach (var str in _cssQueue)
            {
                if (!string.IsNullOrWhiteSpace(str)) sb.Append($" {str}");
            }
            return sb.ToString().Trim();
        }
    }
}
```
### List Components

#### UIListColumn

`UIListColumn` builds out the header and data rows.
1. If `IsHeader` is cascaded and `true` it builds the header row.
2. If `IsMaxColumn` is set it builds out a column with overflow control.
3. With no overrides, it builds out a standard `td` Column.

```csharp
// File: Blazr.Primer.UI.Components/Components/ListControls/UIListColumn.razor.cs
using Microsoft.AspNetCore.Components;
using System.Collections.Generic;

namespace Blazr.Primer.UI.Components
{
    public partial class UIListColumn : UIComponentBase
    {
        [CascadingParameter(Name = "IsHeader")] public bool IsHeader { get; set; }
        [Parameter] public bool IsMaxColumn { get; set; }
        [Parameter] public string HeaderTitle { get; set; }
        [Parameter] public bool IsHeaderNoWrap { get; set; }

        private bool isMaxRowColumn => IsMaxColumn && !this.IsHeader;
        private bool isNormalRowColumn => !IsMaxColumn && !this.IsHeader;
        protected override List<string> UnwantedAttributes { get; set; } = new List<string>() { "class" };

        private string HeaderCSS
            => CSSBuilder.Class()
                .AddClass("header-column-nowrap", "header-column", IsHeaderNoWrap)
                .AddClass("align-baseline")
                .Build();
    }
}
```

```html
// File: Blazr.Primer.UI.Components/Components/ListControls/UIistColumn.razor
@namespace Blazr.Primer.UI.Components
@inherits UIComponentBase

@if (this.IsHeader)
{
    <th class="@this.HeaderCSS">
        @((MarkupString)this.HeaderTitle)
    </th>
}
else if (this.isMaxRowColumn)
{
    <td class="max-column" @attributes="this.SplatterAttributes">
        <div class="grid-overflow">
            <div class="grid-overflowinner">
                @ChildContent
            </div>
        </div>
    </td>
}
else
{
    <td class="data-column" @attributes="this.SplatterAttributes">
        @this.ChildContent
    </td>
}
```

```css
// File: Blazr.Primer.UI.Components/Components/ListControls/UIistColumn.razor.css
.data-column {
    max-width: 30%;
}

.max-column {
    width:50%;
}

.grid-overflow {
    display: flex;
}

.grid-overflowinner {
    flex: 1;
    width: 1px;
    overflow-x: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
}

.header-column-nowrap {
    white-space: nowrap;
}
```

#### UIListControl

`UIListControl` builds out the table framework.

1. The `RowTemplate` has a `TRecord` context.
2. The builder uses the `RowTemplate` to build out the header by cascading `IsHeader` to the template.  It passes the `RowTemplate` a default instance of `TRecord`.
3. Data is only displayed when `IsLoaded` is true.

```html
// File: Blazr.Primer.UI.Components/Components/ListControls/UIListControl.razor
@namespace Blazr.Primer.UI.Components
@inherits UIComponentBase
@typeparam TRecord

@if (this.IsLoaded && this.HasRecords )
{
    <table @attributes="this.SplatterAttributes">
        <thead>
            <CascadingValue Name="IsHeader" Value="true">
                <tr>
                    @RowTemplate(default(TRecord))
                </tr>
            </CascadingValue>
        </thead>
        <tbody>
            @foreach (var item in this.Records)
            {
                <tr>
                    @RowTemplate(item)
                </tr>
            }
        </tbody>
    </table>
}
else if (this.IsLoaded)
{
    <div class="alert alert-warning">
        No Records to Display
    </div>
}
else
{
    <div class="m-2 p-2">Loading...</div>
}
@code {
    [Parameter] public bool IsLoaded { get; set; }
    [Parameter] public bool HasRecords { get; set; }
    [Parameter] public RenderFragment<TRecord> RowTemplate { get; set; }
    [Parameter] public IEnumerable<TRecord> Records { get; set; }
}
```

### Form and RouteView Components

#### WeatherForecastListForm

`WeatherForecastListForm` is the form for displaying `WeatherForecasts`.

The form:
1. Injects the `WeatherForecastViewService` and call `GetRecordsAsync` to get the records.
2. Uses the `UIListControl` and `UIListColumn` components to define the list.

```html
\\ File: Blazr.Primer.UI/Forms/WeatherForecast/WeatherForecastListForm.razor
@namespace Blazr.Primer.UI.Forms

<UIListControl TRecord="WeatherForecast" Records="this.ViewService.Records" IsLoaded="this.ViewService.HasRecordList" HasRecords="this.ViewService.HasRecords" class="table">
    <RowTemplate>
        <UIListColumn HeaderTitle="Date">@context.Date.ToShortDateString()</UIListColumn>
        <UIListColumn HeaderTitle="Temp &deg; C">@context.TemperatureC</UIListColumn>
        <UIListColumn HeaderTitle="Temp &deg; F">@context.TemperatureF</UIListColumn>
        <UIListColumn HeaderTitle="Summary">@context.Summary</UIListColumn>
        <UIListColumn HeaderTitle="Detail" IsMaxColumn="true">@context.Name</UIListColumn>
    </RowTemplate>
</UIListControl>

@code {
    [Inject] WeatherForecastViewService ViewService { get; set; }

    protected override async Task OnInitializedAsync()
    {
        await ViewService.GetRecordsAsync();
    }
}
```

### WeatherForcasts

`WeatherForcasts` is the RouteView.

```html
// File: BlazorDB.UI.RouteViews/WeatherForecasts.razor
@page "/WeatherForecasts"
@page "/wasm/WeatherForecasts"
<WeatherForecastListForm/>
```

## Navigation Update

Add a link to NavMenu

```html
<div class="@NavMenuCssClass" @onclick="ToggleNavMenu">
    <ul class="nav flex-column">
        ....
        <li class="nav-item px-3">
            <NavLink class="nav-link" href="weatherforecasts">
                <span class="oi oi-list-rich" aria-hidden="true"></span> WeatherForecasts
            </NavLink>
        </li>
    </ul>
</div>
```

## Testing

We use **bUnit** to test components.  It runs the component in a Renderer environment and gives us access to interact with it, and examine the rendered DOM.

Add folder *Components* to *BlazorDB.Test* and add a `WeatherForcastFormTests` class.

See the inline comments for details.

```csharp
sing AngleSharp.Html.Dom;
using Blazr.Primer.Core;
using Blazr.Primer.Test;
using Blazr.Primer.UI.Forms;
using Bunit;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using Xunit;

namespace Blazr.Primer.Component.Tests
{
    public class WeatherForecastFormTests
    {

        [Fact]
        public void WeatherForcastListFormShouldDisplayDataRows()
        {
            // define : Set up a fixed size record table
            var rowsToTest = 10;
            // Gets a List of WeatherForecasts
            var dataRows = WeatherForecastHelper.CreateRandomWeatherForecastList(rowsToTest);
            // Mocks a IDataConnector
            var dataConnectorMock = new Mock<IDataConnector>();
            // Sets up the Mock to reply to GetRecordsAsync with out datarows
            dataConnectorMock.Setup(item =>
                item.GetRecordsAsync<WeatherForecast>())
               .Returns(WeatherForecastHelper.CreateWeatherForecastListAsync(dataRows));

            // Sets up Test Context to run our component in
            using var ctx = new TestContext();
            // Adds the Mock IDataConnector
            ctx.Services.AddSingleton<IDataConnector>(dataConnectorMock.Object);
            // Adds a WeatherForecatViewService - this will get the mock IDataConnector injected when it get instanciated.
            ctx.Services.AddSingleton<WeatherForecastViewService>();


            // Act: 
            // Renders the WeatherForecastListForm component and gets the html DOM
            var cut = ctx.RenderComponent<WeatherForecastListForm>();

            // Assert:
            // Get the root node 
            var content = cut.Nodes[0];
            // And check it is a Html Table
            Assert.True(content is IHtmlTableElement);
            // Get the Table
            var table = (IHtmlTableElement)content;
            // Check it has 1 header row
            Assert.True(table.Head.Rows.Length == 1);
            // And 5 columns in the header
            Assert.True(table.Head.Rows[0].Cells.Length == 5);
            // Check it has rowsToTest rows in the body
            Assert.True(table.Bodies[0].Rows.Length == rowsToTest);
            // Get the body rows collection
            var rows = table.Bodies[0].Rows;
            for (var row = 0; row < rows.Length; row++)
            {
                // Check the row has 5 cells
                Assert.True(rows[row].Cells.Length == 5);
                // Check the row Id is the record ID
                Assert.True(rows[row].Id.Equals(dataRows[row].ID.ToString()));
                // Check the first cell contains the datarow date value
                Assert.True(this.GetCellContent(rows[row].Cells[0]).Equals(dataRows[row].Date.ToShortDateString()));
                // Check the second cell contains the datarow TemperatureC value
                Assert.True(this.GetCellContent(rows[row].Cells[1]).Equals(dataRows[row].TemperatureC.ToString()));
                // Check the third cell contains the datarow TemperatureF value
                Assert.True(this.GetCellContent(rows[row].Cells[2]).Equals(dataRows[row].TemperatureF.ToString()));
                // Check the fourth cell contains the datarow Summary value
                Assert.True(this.GetCellContent(rows[row].Cells[3]).Equals(dataRows[row].Summary));
                // Check the fifth cell contains the datarow Name value
                Assert.True(this.GetCellContent(rows[row].Cells[4]).Equals(dataRows[row].Name));
            }
        }

        [Fact]
        public void WeatherForcastListFormShouldDisplayNoDataRows()
        {
            // define : Set up a fixed size record table
            var rowsToTest = 0;
            // Gets a List of WeatherForecasts
            var dataRows = WeatherForecastHelper.CreateRandomWeatherForecastList(rowsToTest);
            // Mocks a IDataConnector
            var dataConnectorMock = new Mock<IDataConnector>();
            // Sets up the Mock to reply to GetRecordsAsync with out datarows
            dataConnectorMock.Setup(item =>
                item.GetRecordsAsync<WeatherForecast>())
               .Returns(WeatherForecastHelper.CreateWeatherForecastListAsync(dataRows));

            // Sets up Test Context to run our component in
            using var ctx = new TestContext();
            // Adds the Mock IDataConnector
            ctx.Services.AddSingleton<IDataConnector>(dataConnectorMock.Object);
            // Adds a WeatherForecatViewService - this will get the mock IDataConnector injected when it get instanciated.
            ctx.Services.AddSingleton<WeatherForecastViewService>();


            // Act: 
            // Renders the WeatherForecastListForm component and gets the html DOM
            var cut = ctx.RenderComponent<WeatherForecastListForm>();

            // Assert:
            // Get the root node 
            var content = cut.Nodes[0];
            Assert.Contains("No Records to Display", content.TextContent.ToString());
        }

        private string GetCellContent(IHtmlTableCellElement cell)
            => cell.ClassName.Contains("max-column")
            ? cell.Children[0].Children[0].InnerHtml
            : cell.InnerHtml;
    }
}
```
