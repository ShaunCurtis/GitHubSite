---
title: DotNetCore XML/XSD Serialization
precis: A quick method to Deserialize Data with a XSD definition
date: 2020-10-01
---

# DotNetCore XML/XSD Serialization

There are plenty of articles on the web showing you how to serialize/Deserialize XML - some good, but most just re-gurgitation of the same content.  I'm not going to do that here.  Almost nobody covers how to do it quickly in scenarios where you have a XSD XML definition file.

[There's a Github Repository here](https://github.com/ShaunCurtis/GPXReader) to accompany this article.


To demonstrate the process we're going to import GPX files.  These are XML formatted files with a *gpx* extension.  [The detailed XSD definition is here](https://www.topografix.com/GPX/1/1/).

One look at the definition will tell you how complex and detailed the GPX standard is, and how much effort would be required to code and test the classes manually.  Luckily Microsoft provide a little known tool to automate the process, buried away in the Windows SDK - *XSD.exe*.

## Building the Classes

1. Set up a bare bones DotNetCore console project (if you use Visual Studio the IDE will do some clever XSD to class associations for you).
2. Get the XSD file and add it to a subfolder - [GPX.xsd](https://www.topografix.com/GPX/1/1/gpx.xsd) - in this case *Gpx*.
3. Find XSD.exe.  It's in the Windows SDK - at the moment in my case its in *C:\Program Files (x86)\Microsoft SDKs\Windows\v10.0A\bin\NETFX 4.8 Tools*.
4. Open a console/powershell window, and change to the *XSD.exe* directory.
5. Run *XSD.exe* against the xsd file.  Note I've set the output to the input directory.

```powershell
.\xsd.exe "D:\Documents\GitHub\GPXReader\Gpx\gpx.xsd" /c /outputdir:"D:\Documents\GitHub\GpxReader\Gpx"
```

The result should be (I've added the separation ============= to make it clearer):

```powershell
PS C:\Program Files (x86)\Microsoft SDKs\Windows\v10.0A\bin\NETFX 4.8 Tools> .\xsd.exe "D:\Documents\GitHub\GPXReader\Gpx\gpx.xsd" /c /outputdir:"D:\Documents\GitHub\GPXReader\Gpx"

==========================================================
Microsoft (R) Xml Schemas/DataTypes support utility
[Microsoft (R) .NET Framework, Version 4.8.3928.0]
Copyright (C) Microsoft Corporation. All rights reserved.
Writing file 'D:\Documents\GitHub\GPXReader\Gpx\gpx.cs'.

===========================================================
PS C:\Program Files (x86)\Microsoft SDKs\Windows\v10.0A\bin\NETFX 4.8 Tools>
```

In the project you should now see:

![gpxclass](https://github.com/ShaunCurtis/GPXReader/blob/master/images/GPX-class.png?raw=true)

Don't be tempted into a renaming exercice (I don't like those class names either!).  Think about your code maintainence process if the definition gets updated.

## Import Code

We now need a simple Importer Class to show we're importing data correctly.  The methods are all `static` and use streams because `XmlSerializer` uses streams not strings.

`ReadFile` - there are two versions:

1. Creates a `StreamReader` to get the import file.
2. Creates an `XmlSerializer` object with the correct object type and XSD definition.
3. Runs `Deserialise`, casting the result to the correct object type.
4. Object disposal is handled by `using`.

`WriteFile`:

1. Creates a `StreamWriter` to accept the `XmlSerializer` output - points to the output file.
2. Creates an `XmlSerializer` object with the correct object type and XSD definition.
3. Runs `Serialize`, outputting to the `StreamWriter`.
4. Flushes the `StreamWriter` to write data to the file.
5. Object disposal is handled by `using`.


```csharp
using System;
using System.IO;
using System.Xml.Serialization;

namespace GPXReader
{
    public class GPXReader
    {
        public static gpxType ReadFile(Uri url)
        {
            gpxType gpxdata = null;
            try
            {
                using (StreamReader reader = new StreamReader(url.AbsolutePath))
                {
                    XmlSerializer serializer = new XmlSerializer(typeof(gpxType), "http://www.topografix.com/GPX/1/1");
                    gpxdata = serializer.Deserialize(reader) as gpxType;
                }
            }
            catch (Exception e)
            {
                Console.WriteLine($"An Error has occurred accessing file {url.AbsolutePath}.{Environment.NewLine} Details:{Environment.NewLine} {e.StackTrace}.");
            }
            return gpxdata;
        }
        
        //  Bool return version
        public static bool ReadFile(Uri url, out gpxType gpxdata)
        {
            gpxdata = null;
            try
            {
                using (StreamReader reader = new StreamReader(url.AbsolutePath))
                {
                    XmlSerializer serializer = new XmlSerializer(typeof(gpxType), "http://www.topografix.com/GPX/1/1");
                    gpxdata = serializer.Deserialize(reader) as gpxType;
                    return true;
                }
            }
            catch (Exception e)
            {
                Console.WriteLine($"An Error has occurred accessing file {url.AbsolutePath}.{Environment.NewLine} Details:{Environment.NewLine} {e.StackTrace}.");
            }
            return false;
        }

        public static bool WriteFile(gpxType data, Uri url)
        {
            try
            {
                using (StreamWriter writer = new StreamWriter(url.AbsolutePath, false))
                {
                    XmlSerializer serializer = new XmlSerializer(typeof(gpxType), "http://www.topografix.com/GPX/1/1");
                    serializer.Serialize(writer, data);
                    writer.Flush();
                    return true;
                }
            }
            catch (Exception e)
            {
                Console.WriteLine($"An Error has occurred accessing file {url.AbsolutePath}.{Environment.NewLine} Details:{Environment.NewLine} {e.StackTrace}.");
            }
            return false;
        }

    }
}
```

I've added a fairly complex gpx file (imported from Google Maps) to the project.

Finally we build a simple `Program` like this:

```csharp
using System;

namespace GPXReader
{
    class Program
    {
        static void Main(string[] args)
        {
            Console.WriteLine("GPX Reader");

            var data = GPXReader.ReadFile(new Uri($"D:/Documents/GitHub/GPXReader/gpx/Test.gpx"));

            Console.WriteLine($"Read file");

            // Set Break point here to view the imported file

            Console.WriteLine($"Writing output file");

            GPXReader.WriteFile(data, new Uri($"D:/Documents/GitHub/GPXReader/gpx/output.gpx"));

            Console.WriteLine("Complete");
        }
    }
}
```

The project looks like this:

![data view](https://github.com/ShaunCurtis/GPXReader/blob/master/images/project-view.png?raw=true)

###  Testing Output

Run the project with a breakpoint set and explore the created `data` object.

![data view](https://github.com/ShaunCurtis/GPXReader/blob/master/images/Object-Local.png?raw=true)

That's it.