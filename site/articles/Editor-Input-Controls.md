---
title: Builing Blazor Editor Input Controls
oneliner: This article describes how to build custom editor Input controls.
precis: The third article in a series describing how to build Blazor edit forms/controls with state management, validation and form locking.  This article focuses on form locking.
date: 2021-03-17
published: 2021-03-11
---

# Editor Input Controls

This article describes how to build custom editor Input controls.

While the out-of-the-box Input controls cover the basics, there's always the odd field that requires a custom approach to make the editing experience work well.  The first part of this article shows you how to build a base editor component that's a little more flexible than `InputBase`, but still fits within the `EditForm` and validation framework.  The second part builds three useful controls using the base component.  These are:

- A text input control that uses a DataList to suggest and filter the options based on the types text.  The control Value is the string.
- The same text input control but using key/Value `<int>,<string>` dictionary to display/filter the value where the control `Value` is the key.
- A button group control to select from a small number of options, again working with a key/Value `<int>,<string>` dictionary.  A much more compact and visual control than say a group of radio buttons.

## Building the MyInput Test Control

Before we build the base control let's build a test control and page to explore what's going on in input controls.

Our starting point is a standard Razor component with a code behind file.  Add a *Component* folder to a standard Blazor Server template built site - *MyInput.razor* and *MyInput.Razor.cs*.

Add the following code to *MyInput.razor.cs*.

1. We have what has come to be known as the "Triumverate" of bind properties.
   1. `Value` is the actual displayed value.
   2. `ValueChanged` is Callback that gets wired up to set the value in the parent.
   3. `ValueExpression` is a lambda expression that points back to the source property in the parent.  We'll see it's purpose later in the article.
2. `CurrentValue` is the control internal *Value*.  It updates `Value` and invokes `ValueChanged` when changed.
3. `AdditionalAttributes` is used to capture the class and other attributes added to the control.

```csharp
namespace BlazorServer.Components
{
    public partial class MyInput
    {
        [Parameter] public string Value { get; set; }
        [Parameter] public EventCallback<string> ValueChanged { get; set; }
        [Parameter] public Expression<Func<string>> ValueExpression { get; set; }
        [Parameter(CaptureUnmatchedValues = true)] public IReadOnlyDictionary<string, object> AdditionalAttributes { get; set; }

        protected virtual string CurrentValue
        {
            get => Value;
            set
            {
                if (!value.Equals(this.Value))
                {
                    Value = value;
                    if (ValueChanged.HasDelegate)
                        _ = ValueChanged.InvokeAsync(value);
                }
            }
        }
    }
}
```

Add a Text `input` html control to the razor file.

1. Namespace is added so *Components* can be divided into subfolders as the number of source files grow.
2. `@bind-value` points to the controls `CurrentValue` property.
3. `@attributes` adds the control attributes to `input`.

```html
@namespace TestBlazorServer.Components

<input type="text" @bind-value="this.CurrentValue" @attributes="this.AdditionalAttributes" />
```

#### Test Page

Add a Test page to *Pages* - or overwrite index if you're using a test site.

This doesn't need much explanation.  Bootstrap for formatting, classic `EditForm`.  `CheckButton` gives us a easy breakpoint we can hit to check values and objects.

You can see our `MyInput` in the form.

```html
@page "/"

@using TestBlazorServer.Components

<EditForm Model="this.model" OnValidSubmit="this.ValidSubmit">
    <div class="container m-5 p-4 border border-secondary">
        <div class="row mb-2">
            <div class="col-12">
                <h2>Test Editor</h2>
            </div>
        </div>
        <div class="row mb-2">
            <div class="col-4 form-label" for="txtcountry">
                Country
            </div>
            <div class="col-4">
                <MyInput id="txtcountry" @bind-Value="model.Value" class="form-control"></MyInput>
            </div>
        </div>
        <div class="row mb-2">
            <div class="col-6">
            </div>
            <div class="col-6 text-right">
                <button class="btn btn-secondary" @onclick="(e) => this.CheckButton()">Check</button>
                <button type="submit" class="btn btn-primary">Submit</button>
            </div>
        </div>
    </div>
</EditForm>

<div class="container">
    <div class="row mb-2">
        <div class="col-4 form-label">
            Test Value
        </div>
        <div class="col-4 form-control">
            @this.model.Value
        </div>
    </div>
    <div class="row mb-2">
        <div class="col-4 form-label">
            Test Index
        </div>
        <div class="col-4 form-control">
            @this.model.index
        </div>
    </div>
</div>
```
```csharp
@code {

    Model model = new Model() { Value = "Australia", index = 2 };

    private void CheckButton()
    {
        var x = true;
    }

    private void ValidSubmit()
    {
        var x = true;
    }

    class Model
    {
        public string Value { get; set; } = string.Empty;
        public int index { get; set; } = 0;
    }
}
```

This should work and update the model values as you change the text in `MyInput`.  So what's going on?

Under the hood the Razor compiler builds the section containing `MyInput` into component code like this:

```csharp
__builder2.OpenComponent<TestBlazorServer.Components.MyInput>(12);
__builder2.AddAttribute(13, "id", "txtcountry");
__builder2.AddAttribute(14, "class", "form-control");
__builder2.AddAttribute(15, "Value", Microsoft.AspNetCore.Components.CompilerServices.RuntimeHelpers.TypeCheck<System.String>(model.Value));
__builder2.AddAttribute(16, "ValueChanged", Microsoft.AspNetCore.Components.CompilerServices.RuntimeHelpers.TypeCheck<Microsoft.AspNetCore.Components.EventCallback<System.String>>(Microsoft.AspNetCore.Components.EventCallback.Factory.Create<System.String>(this, Microsoft.AspNetCore.Components.CompilerServices.RuntimeHelpers.CreateInferredEventCallback(this, __value => model.Value = __value, model.Value))));
__builder2.AddAttribute(17, "ValueExpression", Microsoft.AspNetCore.Components.CompilerServices.RuntimeHelpers.TypeCheck<System.Linq.Expressions.Expression<System.Func<System.String>>>(() => model.Value));
__builder2.CloseComponent();
```

`@bind-value` has translated into a full mapping to the `Value`, `ValueChanged`, `ValueExpression` triumvirate. The setting of `Value` and `ValueExpression` are easy to understand.  `ValueChanged` uses a code factory to effectively build a runtime method that is mapped to `ValueChanged` and sets model.Value to the value returned by `ValueChanged`.

So far we've build the base control, but there's no interaction with the `EditContext` or validation.  We'll look at that next.

## Building a Base Input Control

We have two choices. Either:
1. Inherit from `InputBase`, which is the right decision for a lot of controls.  don't re-invent the wheel.
2. Where `InputBase` doesn't expose the functionality you need, build a base control that does.

This next section shows you how to do just that.  A lot of the code is lifted from `InputBase`.

Create `BaseInputControl.cs`. 

Declare the class as follows:

```csharp
#nullable enable
public class BaseInputControl<TValue> : ComponentBase, IDisposable
{
}
#nullable disable
```

Add the following properties.  
1. The triumvirate again but now decalred using generics.
2. The cascaded EditContext from `EditForm` and an internal reference.
3. A FieldIdentifier for `Value`.

```csharp
[Parameter] public TValue? Value { get; set; }
[Parameter] public EventCallback<TValue> ValueChanged { get; set; }
[Parameter] public Expression<Func<TValue>>? ValueExpression { get; set; }
[Parameter(CaptureUnmatchedValues = true)] public IReadOnlyDictionary<string, object>? AdditionalAttributes { get; set; }
[CascadingParameter] public EditContext CascadedEditContext { get; set; } = default!;
protected FieldIdentifier FieldIdentifier { get; set; }
protected EditContext EditContext { get; set; } = default!;
```

`CurrentValue` is updated to handle generics and split to handle various levels of overide. The code has moved to a virtual Method `UpdateValue` and the actual value setting code becomes another virtual method `SetValue`.  `EditContext.NotifyFieldChanged` is called to update the `EditContext` state.

```csharp
        protected virtual TValue? CurrentValue
        {
            get => Value;
            set => UpdateValue(value);
        }

        protected virtual void UpdateValue(TValue? value)
        {
            var hasChanged = !EqualityComparer<TValue>.Default.Equals(value, this.Value);
            if (hasChanged)
            {
                SetValue(value);
                if (ValueChanged.HasDelegate)
                    _ = ValueChanged.InvokeAsync(value);
                if (!FieldIdentifier.Equals(default(FieldIdentifier)))
                    EditContext.NotifyFieldChanged(FieldIdentifier);
            }
        }

        protected virtual void SetValue(TValue? value)
                => Value = value;
```

Override `SetParametersAsync` to:
1. Set the Parameter Properties. 
2. Check there's a cascaded `EditContext` and assign it to the internal `EditContext` property.
3. Get the `FieldIdentifier` for the field.  This is where `ValueExpression` is used.
4. Check the `EditContext` hasn't changed, which is not allowed!
5. Call `base` with an empty set of Parameter Properties - we've already set them.

```csharp
    public override Task SetParametersAsync(ParameterView parameters)
    {
        parameters.SetParameterProperties(this);
        if (EditContext == null)
        {
            if (CascadedEditContext == null)
                throw new InvalidOperationException($"{GetType()} requires a cascading parameter. For example, you can use {GetType().FullName} inside an {nameof(EditForm)}.");
            EditContext = CascadedEditContext;
            if (ValueExpression != null)
                FieldIdentifier = FieldIdentifier.Create(ValueExpression);
        }
        else if (CascadedEditContext != EditContext)
            throw new InvalidOperationException($"{GetType()} does not support changing the EditContext dynamically.");

        return base.SetParametersAsync(ParameterView.Empty);
    }
```

Methods to handle validation state changes such as CSS class changes and aria attributes

```csharp
private string FieldClass
    => EditContext.FieldCssClass(FieldIdentifier);

protected string CssClass
{
    get
    {
        if (AdditionalAttributes != null &&
            AdditionalAttributes.TryGetValue("class", out var @class) &&
            !string.IsNullOrEmpty(Convert.ToString(@class, CultureInfo.InvariantCulture)))
        {
            return $"{@class} {FieldClass}";
        }
        return FieldClass; // Never null or empty
    }
}

private void OnValidateStateChanged(object? sender, ValidationStateChangedEventArgs eventArgs)
{
    UpdateAdditionalValidationAttributes();
    StateHasChanged();
}

private void UpdateAdditionalValidationAttributes()
{
    var hasAriaInvalidAttribute = AdditionalAttributes != null && AdditionalAttributes.ContainsKey("aria-invalid");
    if (EditContext.GetValidationMessages(FieldIdentifier).Any())
    {
        if (hasAriaInvalidAttribute)
            return;

        if (ConvertToDictionary(AdditionalAttributes, out var additionalAttributes))
            AdditionalAttributes = additionalAttributes;

        additionalAttributes["aria-invalid"] = true;
    }
    else if (hasAriaInvalidAttribute)
    {
        if (AdditionalAttributes!.Count == 1)
            AdditionalAttributes = null;
        else
        {
            if (ConvertToDictionary(AdditionalAttributes, out var additionalAttributes))
                AdditionalAttributes = additionalAttributes;
            additionalAttributes.Remove("aria-invalid");
        }
    }
}

private bool ConvertToDictionary(IReadOnlyDictionary<string, object>? source, out Dictionary<string, object> result)
{
    var newDictionaryCreated = true;
    if (source == null)
        result = new Dictionary<string, object>();
    else if (source is Dictionary<string, object> currentDictionary)
    {
        result = currentDictionary;
        newDictionaryCreated = false;
    }
    else
    {
        result = new Dictionary<string, object>();
        foreach (var item in source)
        {
            result.Add(item.Key, item.Value);
        }
    }
    return newDictionaryCreated;
}
```

Finally code to implement `IDisposable`

```csharp
protected virtual void Dispose(bool disposing)
{
}

void IDisposable.Dispose()
{
    EditContext.OnValidationStateChanged -= this.OnValidateStateChanged;
    Dispose(disposing: true);
}
```

The major difference between this base component and `InputBase` is:
1. Access to `CurrentValue` so you can override it.
2. Removal of the type manipulation and type error reporting along with the convertion to/from string values.

## Building a new Input Search Control

Before we work on the control let's build a static version so we can see it in action.  The secific example we'll use here is a Country Selector.

Before we start let's create a helper class to get a country list.  Get the full list from the Repo.

```csharp
using System.Collections.Generic;

namespace TestBlazorServer.Data
{
    public static class Countries
    {
        public static List<KeyValuePair<int, string>> CountryList
        {
            get
            {
                List<KeyValuePair<int, string>> list = new List<KeyValuePair<int, string>>();
                var x = 1;
                foreach (var v in CountryArray)
                {
                    list.Add(new KeyValuePair<int, string>(x, v));
                    x++;
                }
                return list;
            }
        }

        public static SortedDictionary<int, string> CountryDictionary
        {
            get
            {
                SortedDictionary<int, string> list = new SortedDictionary<int, string>();
                var x = 1;
                foreach (var v in CountryArray)
                {
                    list.Add(x, v);
                    x++;
                }
                return list;
            }
        }

        public static string[] CountryArray = new string[]
        {
            "Afghanistan",
            "Albania",
            "Algeria",
.....
            "Zimbabwe",
        };
    }
}
```

Update the Edit page.

1. Replace `MyInput` with a Html `input` cxontrol.
2. Add Razor markup to build a Html `datalist` from the `Countries` class.

```html
......
<div class="col-4">
    <input type="text" list="countrydatalist" class="form-control"/>
    @*<MyInput id="txtcountry" @bind-Value="model.Value" class="form-control"></MyInput>*@
</div>
.....

<datalist id="datalistOptions">
    @foreach (var country in Countries.CountryArray)
    {
        <option value="@country" />
    }
</datalist>

```

Run and test the control.  Type in *State* and see what options you get.

if you try and do this with a `InputText` like this it doesn't work.

```html
 <InputText @bind-Value="model.Value" list="countrydatalsit"></InputText>
```

So let's build our control.

1. Inherit from `BaseInputControl`.
2. Declare a `DataList` Parameter.
3. Create a unique name using GUIDs for the html `DataList` control.
4. `UpdateEnteredText` is an event handler that is wired into `OnInput`. It updates `_typedText` on any keyboard entry.
5. `OnKeyDown` monitors keyboard entry and acts on a Tab to set the `CurrentValue` to the first entry in the list that matches the selected text.
6. `_valueSetByTab` controls `CurrentValue` from setting `Value` back to the typed text when the user Tabs.  The Tab `OnKeyDown`event precedes the `OnChange` event caused by the control losing focus.

```csharp
    public partial class InputSearchControl : BaseInputControl<string>
    {
        [Parameter] public IEnumerable<string> DataList { get; set; }

        private string dataListId { get; set; } = Guid.NewGuid().ToString();

        private bool _valueSetByTab = false;
        private string _typedText = string.Empty;

        protected override void UpdateValue(string value)
        {
            if (!this._valueSetByTab)
            {
                if (DataList.Any(item => item.Contains(value, StringComparison.CurrentCultureIgnoreCase)))
                    base.UpdateValue(value);
                else
                    base.UpdateValue(string.Empty);
            }
        }

        private void UpdateEnteredText(ChangeEventArgs e)
           => _typedText = e.Value.ToString();

        private void OnKeyDown(KeyboardEventArgs e)
        {
            Debug.WriteLine($"Key: {e.Key}");
            if ((!string.IsNullOrWhiteSpace(e.Key)) && e.Key.Equals("Tab"))
            {
                if (DataList.Any(item => item.Contains(_typedText, StringComparison.CurrentCultureIgnoreCase)))
                {
                    var filteredList = DataList.Where(item => item.Contains(_typedText, StringComparison.CurrentCultureIgnoreCase)).ToList();
                    this.CurrentValue = filteredList[0];
                    _valueSetByTab = true;
                }
            }
        }
    }

```

The Razor markup is similar to before.
1. Input uses the CSS generated by the control.
2. Binds to `CurrentValue`.
3. Adds the additional Atrtributes, inclding the `aria` ones generated by the control.
4. Binds the `datalist`.
5. Hooks up event handlers to `oninput` and 'onkeydown'.
2. Builds the `datalist` from the control `DataList` property.

```html
@namespace TestBlazorServer.Components
@inherits BaseInputControl<string>

<input class="@CssClass" type="text" @bind-value="this.CurrentValue" @attributes="this.AdditionalAttributes" list="@dataListId"  @oninput="UpdateEnteredText" @onkeydown="OnKeyDown" />

<datalist id="@dataListId">
    @foreach (var value in this.DataList)
    {
        <option value="@value" />
    }
</datalist>
```
Test the control in the test page

```html
<div class="col-4">
    <InputSearchControl @bind-Value="model.Value" DataList="Countries.CountryArray" class="form-control" placeholder="Select a country"></InputSearchControl>
</div>
```


## Input Search Select Control

Moving on, what about the same but using an id/value pair, such as you get from a database?  In this case our `Value` is an `int`, but the text box contains text.  No problem.

Copy `InputSearchControl` and rename it to `InputSearchSelectControl`.

Change the generic declaration to `int`.
```csharp
public partial class InputSearchSelectControl : BaseInputControl<int>
```

Change DataList to a `SortedDictionary`.
```csharp
[Parameter] public SortedDictionary<int, string> DataList { get; set; }
```

We need to get a bit cleverer as weneed to switch between text values in the `input` and int values in the control.

Add a new property `CurrentStringValue` to `bind-value` to the `input` control.  This uses Linq to get the value from the `DataList`, and looks up the `key` for a submitted value to set `CurrentValue`.

```csharp
protected string CurrentStringValue
{
    get
    {
        if (DataList.Any(item => item.Key == this.Value))
            return DataList.First(item => item.Key == this.Value).Value;
        return string.Empty;
    }
    set
    {
        if (!_valueSetByTab)
        {
            var val = 0;
            if (DataList.ContainsValue(value))
                val = DataList.First(item => item.Value == value).Key;
            this.CurrentValue = val;
            var hasChanged = val != Value;
        }
        _valueSetByTab = false;
    }
}
```

`OnKeyDown` changes a little to adopt to a key/value pair rather then a string array.

```csharp
private void OnKeyDown(KeyboardEventArgs e)
{
    Debug.WriteLine($"Key: {e.Key}");
    if ((!string.IsNullOrWhiteSpace(e.Key)) && e.Key.Equals("Tab"))
    {
        if (DataList.Any(item => item.Value.Contains(_typedText, StringComparison.CurrentCultureIgnoreCase)))
        {
            var filteredList = DataList.Where(item => item.Value.Contains(_typedText, StringComparison.CurrentCultureIgnoreCase)).ToList();
            this.CurrentValue = filteredList[0].Key;
            _valueSetByTab = true;
        }
    }
}
```

The Razor is almost the same.

1. Changed the `bind-value` to `CurrentStringValue`.
2. updated the `datalist` builder to handle key/value pairs.

```html
@namespace TestBlazorServer.Components
@inherits BaseInputControl<int>

<input class="@CssClass" type="text" @bind-value="this.CurrentStringValue" @attributes="this.AdditionalAttributes" list="@dataListId" @oninput="UpdateEnteredText" @onkeydown="OnKeyDown" />

<datalist id="@dataListId">
    @foreach (var kv in this.DataList)
    {
        <option value="@kv.Value" />
    }
</datalist>
```

Test it by adding a row to the edit table in the test page.

```csharp
<div class="row mb-2">
    <div class="col-4 form-label" for="txtcountry">
        Country Index
    </div>
    <div class="col-4">
        <InputSearchSelectControl @bind-Value="model.Index" DataList="Countries.CountryDictionary" class="form-control" placeholder="Select a country"></InputSearchSelectControl>
    </div>
</div>
```

```csharp
```



======
