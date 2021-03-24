<template>
    <div>
        <div v-for="article in articles" class="card">
            <div class="card-header">
            <div>
                <router-link :to="article.path">
                    {{ article.frontmatter.title }}
                </router-link>
            </div>
            <div class="text-right">{{ formateDate(article.frontmatter.date)}}</div>
            </div>
            <div class="card-content">{{ article.frontmatter.precis }}</div>
        </div>
    </div>
</template>

<script>
import moment from "moment";
export default {
    computed: {
        articles() {
            var arts = this.$site.pages
                .filter(x => x.path.startsWith('/archivedarticles/') && !x.frontmatter.article_index)
                .sort((a, b) => new Date(b.frontmatter.date) - new Date(a.frontmatter.date));
            return arts.slice(0, 10);
        }
    },
      methods: {
    formateDate(date) {
      return moment(date).format("DD-MMM-YYYY")
    },
  }
}
</script>
<style scoped>
 .card {
   margin: 1rem;
   box-shadow: 0 0 5px rgb(240,240,240);
   border:2px rgb(224,240,255);
 }
 .card-header {
     display: flex;
     justify-content: space-between;
   padding: .6rem 1rem;
   background-color: rgb(224,240,255);
 }
 .card-content {
   padding: .6rem 1.5rem;
   color: rgb(64,64,128);
 }
</style>